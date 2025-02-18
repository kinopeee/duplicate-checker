import assert from 'assert';
import DuplicateChecker from './duplicate-checker.js';
import fs from 'fs';
import path from 'path';

// Basic test setup for both languages
const languages = ['en', 'ja'];

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

// Test both languages
const runTests = async () => {
  for (const lang of languages) {
    console.log(`\nTesting language: ${lang}`);
    process.env.DUPLICATE_CHECKER_LANG = lang;
    
    const testDir = setupTestFiles();
    const checker = new DuplicateChecker(testDir);
    
    try {
      const results = await checker.analyzeDuplicates();
      // Basic structure verification
      assert(Array.isArray(results.functions), 'functions should be an array');
      assert(Array.isArray(results.modules), 'modules should be an array');
      assert(Array.isArray(results.resources), 'resources should be an array');
      
      console.log(`✓ Basic structure tests passed for ${lang}`);
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
