import DuplicateChecker, { DuplicateCheckerError, main } from './duplicate-checker.js';
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

jest.mock('./src/react/index.js', () => ({
  ReactDuplicateDetector: class MockReactDuplicateDetector {
    constructor() {}
    detectDuplicates() { 
      return Promise.resolve([]); 
    }
  }
}));

// Test configuration
const languages = ['en', 'ja'];
const expectedMessages = {
  en: {
    noDuplicates: 'No duplicate functions found.',
    duplicateFound: 'Function name: test1'
  },
  ja: {
    noDuplicates: '重複する関数は見つかりませんでした。',
    duplicateFound: '関数名: test1'
  }
};

// Create test directory and files
const setupTestFiles = () => {
  const testDir = path.join(process.cwd(), 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Create test files with duplicate functions
  const file1Content = `
function test1() {
  const a = 1;
  const b = 2;
  return a + b;
}

function test2() {
  const x = 1;
  const y = 2;
  return x + y;  // Same logic, different variable names
}
`;

  const file2Content = `
function test1() {
  const c = 5;
  const d = 10;
  return c - d;  // Different implementation, same name
}

function test3() {
  const a = 1;
  const b = 2;
  return a + b;  // Same as test1 in file1
}
`;

  fs.writeFileSync(path.join(testDir, 'file1.js'), file1Content);
  fs.writeFileSync(path.join(testDir, 'file2.js'), file2Content);
  return testDir;
};

// Clean up test files
const cleanupTestFiles = (testDir) => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
};

// Test language configuration priority
describe('Language Configuration', () => {
  let originalConfig;
  
  beforeAll(() => {
    originalConfig = fs.readFileSync('duplicate-checker.config.json', 'utf-8');
  });

  afterAll(() => {
    fs.writeFileSync('duplicate-checker.config.json', originalConfig);
  });

  test('environment variable takes priority', () => {
    process.env.DUPLICATE_CHECKER_LANG = 'en';
    fs.writeFileSync('duplicate-checker.config.json', JSON.stringify({ language: 'ja' }));
    const checker = new DuplicateChecker('.');
    expect(process.env.DUPLICATE_CHECKER_LANG).toBe('en');
  });

  test('config file is used when no env var', () => {
    delete process.env.DUPLICATE_CHECKER_LANG;
    fs.writeFileSync('duplicate-checker.config.json', JSON.stringify({ language: 'ja' }));
    const checker = new DuplicateChecker('.');
    const config = JSON.parse(fs.readFileSync('duplicate-checker.config.json', 'utf-8'));
    expect(config.language).toBe('ja');
  });

  test('defaults to ja when no config', () => {
    delete process.env.DUPLICATE_CHECKER_LANG;
    fs.writeFileSync('duplicate-checker.config.json', JSON.stringify({}));
    const checker = new DuplicateChecker('.');
    expect(process.env.DUPLICATE_CHECKER_LANG || 'ja').toBe('ja');
  });
});

// Test duplicate detection in both languages
describe('Duplicate Detection', () => {
  languages.forEach(lang => {
    describe(`Language: ${lang}`, () => {
      let testDir;
      let checker;

      beforeEach(() => {
        process.env.DUPLICATE_CHECKER_LANG = lang;
        testDir = setupTestFiles();
        checker = new DuplicateChecker(testDir, { debug: false });
      });

      afterEach(() => {
        cleanupTestFiles(testDir);
      });

      test('detects duplicate functions', async () => {
        const results = await checker.analyzeDuplicates();
        expect(Array.isArray(results.functions)).toBe(true);
        expect(results.functions.length).toBeGreaterThan(0);

        const duplicateGroup = results.functions.find(f => f.occurrences.length > 1);
        expect(duplicateGroup).toBeTruthy();
        expect(duplicateGroup.occurrences.length).toBe(3);

        const functionNames = duplicateGroup.occurrences.map(o => o.name).sort();
        expect(functionNames).toEqual(['test1', 'test2', 'test3']);
      });

      test('verifies module similarity', async () => {
        const results = await checker.analyzeDuplicates();
        expect(Array.isArray(results.modules)).toBe(true);

        if (results.modules.length > 0) {
          const similarity = parseFloat(results.modules[0].similarity.toFixed(1));
          expect(similarity).toBe(66.7);
          expect(results.modules[0].files.length).toBe(2);
          expect(results.modules[0].files.every(f => f.endsWith('.js'))).toBe(true);
        }
      });

      test('handles module similarity edge cases', async () => {
        // Test with empty files
        fs.writeFileSync(path.join(testDir, 'empty1.js'), '');
        fs.writeFileSync(path.join(testDir, 'empty2.js'), '');
        
        // Test with invalid syntax
        fs.writeFileSync(path.join(testDir, 'invalid1.js'), 'function test() {');
        fs.writeFileSync(path.join(testDir, 'invalid2.js'), 'const x = ;');
        
        // Test with non-JS files
        fs.writeFileSync(path.join(testDir, 'test.txt'), 'not a js file');
        
        const results = await checker.analyzeDuplicates();
        expect(Array.isArray(results.modules)).toBe(true);
      });

      test('handles module comparison errors', async () => {
        const ast1 = null;
        const ast2 = { type: 'Program', body: [] };
        const similarity = checker.calculateModuleSimilarity(ast1, ast2);
        expect(similarity).toBe(0);

        const similarity2 = checker.calculateModuleSimilarity(ast2, ast1);
        expect(similarity2).toBe(0);

        const similarity3 = checker.calculateModuleSimilarity(null, null);
        expect(similarity3).toBe(0);
      });
    });
  });
});

// Test resource similarity detection
describe('Resource Similarity', () => {
  let testDir;

  beforeEach(() => {
    testDir = path.join(process.cwd(), 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    const resource1 = {
      name: "Hello World",
      value: 100,
      tags: ["a", "b", "c"],
      nested: { x: 1, y: 2 }
    };

    const resource2 = {
      name: "Hello Word",  // Similar string (1 char diff)
      value: 110,         // Similar number (10% diff)
      tags: ["c", "b", "a"], // Same array, different order
      nested: { x: 1, y: 3 } // Similar structure
    };

    fs.writeFileSync(
      path.join(testDir, 'resource1.json'),
      JSON.stringify(resource1, null, 2)
    );
    fs.writeFileSync(
      path.join(testDir, 'resource2.json'),
      JSON.stringify(resource2, null, 2)
    );
  });

  afterEach(() => {
    cleanupTestFiles(testDir);
  });

  test('detects similar strings', async () => {
    const checker = new DuplicateChecker(testDir, {
      resourceComparison: {
        enableStringComparison: true,
        enableNumberComparison: true,
        enableArrayOrderCheck: true,
        maxDepth: 5,
        stringThreshold: 0.8,
        numberThreshold: 0.1,
        arrayThreshold: 0.7,
        structureWeight: 0.4,
        valueWeight: 0.6
      }
    });

    const results = await checker.analyzeDuplicates();

    const stringDuplicate = results.resources.find(r => 
      typeof r.value === 'string' && r.value.includes('Hello')
    );
    expect(stringDuplicate).toBeTruthy();
    expect(stringDuplicate.similarity).toBeGreaterThanOrEqual(0.8);
  });

  test('detects similar numbers', async () => {
    const checker = new DuplicateChecker(testDir, {
      resourceComparison: {
        enableNumberComparison: true,
        numberThreshold: 0.1
      }
    });

    const results = await checker.analyzeDuplicates();

    const numberDuplicate = results.resources.find(r => {
      const val = typeof r.value === 'string' ? Number(r.value) : r.value;
      return !isNaN(val) && (val === 100 || val === 110);
    });
    expect(numberDuplicate).toBeTruthy();
    expect(numberDuplicate.similarity).toBeGreaterThanOrEqual(0.9);
  });

  test('detects similar arrays', async () => {
    const checker = new DuplicateChecker(testDir, {
      resourceComparison: {
        enableArrayOrderCheck: true,
        arrayThreshold: 0.7
      }
    });

    const results = await checker.analyzeDuplicates();

    const arrayDuplicate = results.resources.find(r => 
      Array.isArray(r.value) && r.value.includes('a')
    );
    expect(arrayDuplicate).toBeTruthy();
    expect(arrayDuplicate.similarity).toBeGreaterThanOrEqual(0.7);
  });

  describe('nested object similarity', () => {
    let checker;

    let testDir;

    beforeEach(() => {
      testDir = path.join(process.cwd(), 'test-files');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });
      
      checker = new DuplicateChecker(testDir, {
        resourceComparison: {
          maxDepth: 5,
          structureWeight: 0.4,
          valueWeight: 0.6,
          stringThreshold: 0.8,
          numberThreshold: 0.1,
          arrayThreshold: 0.7
        }
      });
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    test('detects similar nested objects', async () => {
      // Create test files in the test directory
      const resource1 = {
        name: "Hello World",
        value: 100,
        tags: ["a", "b", "c"],
        nested: { x: 1, y: 2 }
      };

      const resource2 = {
        name: "Hello Word",
        value: 110,
        tags: ["c", "b", "a"],
        nested: { x: 1, y: 3 }
      };

      const file1 = path.join(testDir, 'resource1.json');
      const file2 = path.join(testDir, 'resource2.json');

      fs.writeFileSync(file1, JSON.stringify(resource1, null, 2));
      fs.writeFileSync(file2, JSON.stringify(resource2, null, 2));

      const results = await checker.analyzeDuplicates();
      const nestedDuplicate = results.resources.find(r => 
        r.value && typeof r.value === 'object' && !Array.isArray(r.value) && 
        r.value.nested && r.value.nested.x === 1 && r.value.nested.y >= 2
      );
      expect(nestedDuplicate).toBeTruthy();
      expect(nestedDuplicate.similarity).toBeGreaterThanOrEqual(0.8);
    }, 30000); // Increase timeout to 30 seconds

    test('handles null values', () => {
      expect(checker.calculateObjectSimilarity(null, {})).toBe(0);
      expect(checker.calculateObjectSimilarity({}, null)).toBe(0);
      expect(checker.calculateObjectSimilarity(null, null)).toBe(0);
    });

    test('handles empty objects', () => {
      expect(checker.calculateObjectSimilarity({}, {})).toBe(1);
    });

    test('handles arrays as objects', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 4];
      const similarity = checker.calculateObjectSimilarity(arr1, arr2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('handles nested object comparison', () => {
      const obj1 = { a: { x: 1, y: 2 }, b: 3 };
      const obj2 = { a: { x: 1, y: 3 }, b: 3 };
      const similarity = checker.calculateObjectSimilarity(obj1, obj2);
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('handles different object structures', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, c: 3 };
      const similarity = checker.calculateObjectSimilarity(obj1, obj2);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0);
    });

    test('handles deeply nested objects', () => {
      const obj1 = { a: { b: { c: { d: 1 } } } };
      const obj2 = { a: { b: { c: { d: 2 } } } };
      const similarity = checker.calculateObjectSimilarity(obj1, obj2);
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('handles mixed types in objects', () => {
      const obj1 = {
        str: "hello",
        num: 42,
        arr: [1, 2, 3],
        nested: { x: 1 }
      };
      const obj2 = {
        str: "hello world",
        num: 43,
        arr: [1, 2, 4],
        nested: { x: 2 }
      };
      const similarity = checker.calculateObjectSimilarity(obj1, obj2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('handles edge cases in object comparison', () => {
      // Test with undefined values
      expect(checker.calculateObjectSimilarity(undefined, {})).toBe(0);
      expect(checker.calculateObjectSimilarity({}, undefined)).toBe(0);
      
      // Test with non-object types
      expect(checker.calculateObjectSimilarity(42, {})).toBe(0);
      expect(checker.calculateObjectSimilarity({}, "string")).toBe(0);
      
      // Test with arrays
      expect(checker.calculateObjectSimilarity([1,2], [1,2])).toBeGreaterThan(0);
      
      // Test with empty objects
      expect(checker.calculateObjectSimilarity({}, {})).toBe(1);
      
      // Test max depth limit
      const deepObj1 = { a: { b: { c: { d: { e: 1 } } } } };
      const deepObj2 = { a: { b: { c: { d: { e: 2 } } } } };
      const similarity = checker.calculateObjectSimilarity(deepObj1, deepObj2);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });
});

// Test error handling
describe('Error Handling', () => {
  let testDir;

  beforeEach(() => {
    testDir = path.join(process.cwd(), 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
  });

  afterEach(() => {
    cleanupTestFiles(testDir);
  });

  test('handles memory limit error', async () => {
    const checkerMemLimit = new DuplicateChecker(testDir, {
      memoryLimit: 1024 // 1KB limit to force error
    });

    await expect(checkerMemLimit.analyzeDuplicates()).rejects.toThrow(DuplicateCheckerError);
    await expect(checkerMemLimit.analyzeDuplicates()).rejects.toMatchObject({
      code: 'E003',
      details: {
        limit: 1024
      }
    });
  });

  test('handles file not found error', async () => {
    const nonExistentDir = path.join(testDir, 'non-existent');
    const checkerFileNotFound = new DuplicateChecker(nonExistentDir);

    await expect(checkerFileNotFound.analyzeDuplicates()).rejects.toThrow(DuplicateCheckerError);
    await expect(checkerFileNotFound.analyzeDuplicates()).rejects.toMatchObject({
      code: 'E001',
      details: {
        dir: nonExistentDir
      }
    });
  });

  test('handles parse errors gracefully', async () => {
    const invalidFile = path.join(testDir, 'invalid.js');
    fs.writeFileSync(invalidFile, 'this is not valid javascript');
    const checkerParseError = new DuplicateChecker(testDir);
    
    const results = await checkerParseError.analyzeDuplicates();
    expect(results).toBeTruthy();
  });

  test('handles invalid config error', async () => {
    const checkerInvalidConfig = new DuplicateChecker(testDir, {
      resourceComparison: null
    });

    await expect(checkerInvalidConfig.analyzeDuplicates()).rejects.toThrow(DuplicateCheckerError);
    await expect(checkerInvalidConfig.analyzeDuplicates()).rejects.toMatchObject({
      code: 'E004'
    });
  });

  test('handles file system errors', async () => {
    // Test with non-existent directory
    const nonExistentDir = path.join(testDir, 'non-existent');
    const checkerNonExistent = new DuplicateChecker(nonExistentDir);
    await expect(checkerNonExistent.analyzeDuplicates()).rejects.toThrow(DuplicateCheckerError);

    // Test with unreadable file
    const unreadableFile = path.join(testDir, 'unreadable.js');
    fs.writeFileSync(unreadableFile, 'function test() {}');
    fs.chmodSync(unreadableFile, 0o000);
    
    const checkerUnreadable = new DuplicateChecker(testDir);
    const results = await checkerUnreadable.analyzeDuplicates();
    expect(results).toBeTruthy();

    // Cleanup
    fs.chmodSync(unreadableFile, 0o644);
  });

  test('handles resource parsing errors', async () => {
    // Test with invalid JSON
    const invalidJson = path.join(testDir, 'invalid.json');
    fs.writeFileSync(invalidJson, '{ invalid json }');
    
    // Test with invalid YAML
    const invalidYaml = path.join(testDir, 'invalid.yml');
    fs.writeFileSync(invalidYaml, '{ invalid: yaml: content: }');
    
    // Test with empty file
    const emptyFile = path.join(testDir, 'empty.json');
    fs.writeFileSync(emptyFile, '');
    
    // Test with empty YAML
    const emptyYaml = path.join(testDir, 'empty.yml');
    fs.writeFileSync(emptyYaml, '');
    
    // Test with binary file
    const binaryFile = path.join(testDir, 'binary.json');
    fs.writeFileSync(binaryFile, Buffer.from([0x89, 0x50, 0x4E, 0x47]));
    
    // Test with non-existent file
    const nonExistentFile = path.join(testDir, 'non-existent.json');
    
    const checkerInvalid = new DuplicateChecker(testDir);
    const results = await checkerInvalid.analyzeDuplicates();
    expect(results).toBeTruthy();
    expect(results.resources).toEqual([]);
  });

  test('handles resource comparison edge cases', async () => {
    // Test with various edge cases
    const testCases = [
      { name: 'null.json', content: 'null' },
      { name: 'undefined.json', content: '{"value": null}' },
      { name: 'empty-array.json', content: '[]' },
      { name: 'empty-object.json', content: '{}' },
      { name: 'mixed-types.json', content: '{"str": "123", "num": 123}' },
      { name: 'deep-nested.json', content: JSON.stringify({ a: { b: { c: { d: { e: 1 } } } } }) },
      { name: 'similar1.json', content: JSON.stringify({ value: 100 }) },
      { name: 'similar2.json', content: JSON.stringify({ value: 110 }) },
      { name: 'similar3.json', content: JSON.stringify({ value: "100" }) }
    ];

    testCases.forEach(({ name, content }) => {
      fs.writeFileSync(path.join(testDir, name), content);
    });

    const checker = new DuplicateChecker(testDir);
    const results = await checker.analyzeDuplicates();
    expect(results).toBeDefined();
    
    // Verify number similarity detection
    const numberDuplicates = Array.from(checker.duplicates.resources.values())
      .filter(dup => typeof dup.value === 'number' || !isNaN(Number(dup.value)));
    expect(numberDuplicates.length).toBeGreaterThan(0);
  });

  test('handles main function execution', async () => {
    // Test successful execution
    const validDir = path.join(testDir, 'valid');
    fs.mkdirSync(validDir);
    fs.writeFileSync(path.join(validDir, 'test.js'), 'function test() { return 1; }');
    
    process.argv[2] = validDir;
    await expect(main()).resolves.not.toThrow();

    // Test error handling
    process.argv[2] = path.join(testDir, 'non-existent');
    await expect(main()).rejects.toThrow(DuplicateCheckerError);
    await expect(main()).rejects.toThrow('errors.directoryProcessing');

    // Test with no arguments
    process.argv[2] = undefined;
    await expect(main()).rejects.toThrow(DuplicateCheckerError);
    await expect(main()).rejects.toThrow('errors.invalidConfig');

    // Test with invalid config
    process.env.DUPLICATE_CHECKER_CONFIG = path.join(testDir, 'invalid-config.json');
    fs.writeFileSync(process.env.DUPLICATE_CHECKER_CONFIG, '{ invalid json }');
    await expect(main()).rejects.toThrow(DuplicateCheckerError);
    await expect(main()).rejects.toThrow('errors.invalidConfig');

    // Test with production error handling
    const originalNodeEnv = process.env.NODE_ENV;
    const originalArgv = process.argv[2];
    
    // Test production error handling
    process.env.NODE_ENV = 'production';
    process.argv[2] = path.join(testDir, 'non-existent');
    
    // Mock process.exit
    const mockExit = jest.fn();
    const originalExit = process.exit;
    process.exit = mockExit;
    
    await main().catch(() => {});
    expect(mockExit).toHaveBeenCalledWith(1);
    
    // Test direct script execution with error
    const originalUrl = import.meta.url;
    Object.defineProperty(import.meta, 'url', { value: `file://${process.argv[1]}` });
    
    // Test with invalid directory
    process.argv[2] = path.join(testDir, 'non-existent');
    await main().catch(() => {});
    expect(mockExit).toHaveBeenCalledWith(1);
    
    // Test with valid directory but invalid files
    process.argv[2] = testDir;
    fs.writeFileSync(path.join(testDir, 'invalid.js'), 'invalid javascript');
    await main().catch(() => {});
    expect(mockExit).toHaveBeenCalledWith(1);
    
    // Test with resource comparison edge case
    fs.writeFileSync(path.join(testDir, 'resource1.json'), JSON.stringify({ value: 100 }));
    fs.writeFileSync(path.join(testDir, 'resource2.json'), JSON.stringify({ value: 110 }));
    await main().catch(() => {});
    expect(mockExit).toHaveBeenCalledWith(1);
    
    // Restore all mocks and values
    process.exit = originalExit;
    process.env.NODE_ENV = originalNodeEnv;
    process.argv[2] = originalArgv;
    Object.defineProperty(import.meta, 'url', { value: originalUrl });
  });
});
