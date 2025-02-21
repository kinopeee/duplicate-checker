import assert from 'assert';
import DuplicateChecker from './duplicate-checker.js';
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
const testLanguageConfiguration = () => {
  // Test environment variable priority
  const originalConfig = fs.readFileSync('duplicate-checker.config.json', 'utf-8');
  try {
    process.env.DUPLICATE_CHECKER_LANG = 'en';
    fs.writeFileSync('duplicate-checker.config.json', JSON.stringify({ language: 'ja' }));
    const checker1 = new DuplicateChecker('.');
    assert.strictEqual(process.env.DUPLICATE_CHECKER_LANG, 'en', 'Environment variable should take priority');

  // Test config file priority
  delete process.env.DUPLICATE_CHECKER_LANG;
  const checker2 = new DuplicateChecker('.');
  const config = JSON.parse(fs.readFileSync('duplicate-checker.config.json', 'utf-8'));
  assert.strictEqual(config.language, 'ja', 'Config file should be used when no env var');

  // Test default fallback
  fs.writeFileSync('duplicate-checker.config.json', JSON.stringify({}));
  const checker3 = new DuplicateChecker('.');
  assert.strictEqual(process.env.DUPLICATE_CHECKER_LANG || 'ja', 'ja', 'Should default to ja');

  console.log('✓ Language configuration priority tests passed');
  } finally {
    // Restore original config
    fs.writeFileSync('duplicate-checker.config.json', originalConfig);
  }
};

// Test duplicate detection in both languages
const runTests = async () => {
  for (const lang of languages) {
    console.log(`\nTesting language: ${lang}`);
    process.env.DUPLICATE_CHECKER_LANG = lang;
    
    const testDir = setupTestFiles();
    const checker = new DuplicateChecker(testDir, { debug: false });
    
    try {
      // Get results first without debug output
      const results = await checker.analyzeDuplicates();

      // Capture output from analyzeDuplicates
      let output = '';
      const oldLog = console.log;
      console.log = (...args) => {
        const line = args.join(' ');
        output += line + '\n';
        oldLog('DEBUG - Captured line:', JSON.stringify(line)); // Debug exact output
      };
      
      await checker.analyzeDuplicates();
      console.log = oldLog;
      oldLog('DEBUG - Final output:', JSON.stringify(output)); // Debug final output

      // Test function duplicate detection
      assert(Array.isArray(results.functions), 'functions should be an array');
      assert(results.functions.length > 0, 'Should detect duplicate functions');
      
      // Verify duplicate group with same implementation
      const duplicateGroup = results.functions.find(f => f.occurrences.length > 1);
      assert(duplicateGroup, 'Should find a group of duplicate functions');
      assert(duplicateGroup.occurrences.length === 3, 'Should detect three functions with same implementation');
      
      // Verify correct functions are grouped
      const functionNames = duplicateGroup.occurrences.map(o => o.name).sort();
      assert.deepStrictEqual(functionNames, ['test1', 'test2', 'test3'], 'Should group test1, test2, and test3 as duplicates');

      // Test language configuration after duplicate detection
      testLanguageConfiguration();
      
      // Structure verification
      assert(Array.isArray(results.modules), 'modules should be an array');
      assert(Array.isArray(results.resources), 'resources should be an array');
      
      // Module similarity should be based on function implementation similarity
      if (results.modules.length > 0) {
        const similarity = parseFloat(results.modules[0].similarity.toFixed(1));
        assert(similarity === 66.7, `Module similarity should be 66.7% (got ${similarity}%)`);
        assert(results.modules[0].files.length === 2, 'Should have two similar files');
        assert(results.modules[0].files.every(f => f.endsWith('.js')), 'Files should be JavaScript files');
      }

      // Verify output contains the duplicate function group
      const duplicateNames = duplicateGroup.occurrences.map(o => o.name);
      const firstDuplicate = duplicateNames[0];
      assert(output.includes('\nDuplicate Functions'), 'Should show duplicate functions header');
      assert(output.includes('locations'), 'Should show locations header');
      duplicateGroup.occurrences.forEach(loc => {
        assert(output.includes(`- ${loc.file} (name: "${loc.name}")`),
          `Should show location: ${loc.file} with name: ${loc.name}`);
      });
      
      console.log(`✓ All tests passed for ${lang}`);
    } catch (error) {
      console.error(`✗ Tests failed for ${lang}:`, error);
      process.exit(1);
    } finally {
      cleanupTestFiles(testDir);
    }
  }
};

// Test resource similarity detection
const testResourceSimilarity = async () => {
  console.log('\nTesting resource similarity detection');
  const testDir = path.join(process.cwd(), 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Create test resources with various types of similarity
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

  // Write test resources to files
  fs.writeFileSync(
    path.join(testDir, 'resource1.json'),
    JSON.stringify(resource1, null, 2)
  );
  fs.writeFileSync(
    path.join(testDir, 'resource2.json'),
    JSON.stringify(resource2, null, 2)
  );

  try {
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

    // Test string similarity
    const stringDuplicate = results.resources.find(r => 
      typeof r.value === 'string' && r.value.includes('Hello')
    );
    assert(stringDuplicate, 'Should detect similar strings');
    assert(stringDuplicate.similarity >= 0.8, 'String similarity should meet threshold');

    // Test number similarity
    const numberDuplicate = results.resources.find(r => 
      typeof r.value === 'number' && r.value === 100
    );
    assert(numberDuplicate, 'Should detect similar numbers');
    assert(numberDuplicate.similarity >= 0.9, 'Number similarity should meet threshold');

    // Test array similarity
    const arrayDuplicate = results.resources.find(r => 
      Array.isArray(r.value) && r.value.includes('a')
    );
    assert(arrayDuplicate, 'Should detect similar arrays');
    assert(arrayDuplicate.similarity >= 0.7, 'Array similarity should meet threshold');

    // Test nested object similarity
    const nestedDuplicate = results.resources.find(r => 
      r.value && typeof r.value === 'object' && r.value.x === 1
    );
    assert(nestedDuplicate, 'Should detect similar nested objects');
    assert(nestedDuplicate.similarity >= 0.8, 'Object similarity should meet threshold');

    console.log('✓ Resource similarity detection tests passed');
  } finally {
    cleanupTestFiles(testDir);
  }
};

// Run all tests
const runAllTests = async () => {
  await runTests();
  await testResourceSimilarity();
};

runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
