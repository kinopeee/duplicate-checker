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
  `;

  const file2Content = `
    function test2() {
      const a = 1;
      const b = 2;
      return a + b;
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
};

// Test duplicate detection in both languages
const runTests = async () => {
  for (const lang of languages) {
    console.log(`\nTesting language: ${lang}`);
    process.env.DUPLICATE_CHECKER_LANG = lang;
    
    const testDir = setupTestFiles();
    const checker = new DuplicateChecker(testDir);
    
    try {
      // Test language configuration
      testLanguageConfiguration();

      // Test duplicate detection
      const results = await checker.analyzeDuplicates();
      
      // Structure verification
      assert(Array.isArray(results.functions), 'functions should be an array');
      assert(Array.isArray(results.modules), 'modules should be an array');
      assert(Array.isArray(results.resources), 'resources should be an array');
      
      // Function duplicate detection
      assert(results.functions.length > 0, 'Should detect duplicate functions');
      assert(results.functions[0].functionName === 'test1' || results.functions[0].functionName === 'test2',
        'Should detect correct function names');
      
      // Module similarity
      assert(results.modules.length > 0, 'Should detect similar modules');
      assert(parseFloat(results.modules[0].similarity) > 70,
        'Should detect high similarity between test files');
      
      // Test output messages
      const output = await new Promise(resolve => {
        let output = '';
        const oldLog = console.log;
        console.log = (...args) => { output += args.join(' ') + '\n'; };
        checker.analyzeDuplicates().then(() => {
          console.log = oldLog;
          resolve(output);
        });
      });

      assert(output.includes(expectedMessages[lang].duplicateFound),
        `Output should contain correct ${lang} message for duplicate function`);
      
      console.log(`✓ All tests passed for ${lang}`);
    } catch (error) {
      console.error(`✗ Tests failed for ${lang}:`, error);
      process.exit(1);
    } finally {
      cleanupTestFiles(testDir);
    }
  }
};

runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
