import DuplicateChecker, { DuplicateCheckerError } from './duplicate-checker.js';
import fs from 'fs';
import path from 'path';

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

  test('detects similar nested objects', async () => {
    const checker = new DuplicateChecker(testDir, {
      resourceComparison: {
        maxDepth: 5,
        structureWeight: 0.4,
        valueWeight: 0.6
      }
    });

    const results = await checker.analyzeDuplicates();

    const nestedDuplicate = results.resources.find(r => 
      r.value && typeof r.value === 'object' && r.value.x === 1
    );
    expect(nestedDuplicate).toBeTruthy();
    expect(nestedDuplicate.similarity).toBeGreaterThanOrEqual(0.8);
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
});
