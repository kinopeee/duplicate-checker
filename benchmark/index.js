import fs from 'fs';
import path from 'path';
import DuplicateChecker from '../duplicate-checker.js';

async function generateLargeProject(fileCount = 1000) { // Start with smaller count for testing
  const testDir = path.join(process.cwd(), 'benchmark/test-project');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  console.log(`Generating ${fileCount} test files...`);
  // Generate test files with varying content to test duplicate detection
  for (let i = 0; i < fileCount; i++) {
    if (i % 100 === 0) {
      console.log(`Generated ${i} files...`);
    }
    const content = `
      // Simplified test function to reduce complexity
      function test${i}() {
        return ${i % 2 === 0 ? 'a + b' : 'x + y'};
      }

      const resource${i} = {
        name: "Test Resource ${i}",
        value: ${i % 100},
        tags: ${JSON.stringify(['tag' + (i % 5), 'common', 'test'])},
        nested: { x: ${i % 10}, y: ${(i + 1) % 10} }
      };
    `;
    fs.writeFileSync(path.join(testDir, `file${i}.js`), content);

    // Add some JSON resources
    if (i % 10 === 0) {
      const resource = {
        name: `Resource ${i}`,
        value: i % 100,
        tags: ['tag' + (i % 5), 'common', 'test'],
        nested: { x: i % 10, y: (i + 1) % 10 }
      };
      fs.writeFileSync(path.join(testDir, `resource${i}.json`), JSON.stringify(resource, null, 2));
    }
  }
  console.log(`Generated ${fileCount} files`);
  return testDir;
}

async function cleanupTestDir(testDir) {
  if (fs.existsSync(testDir)) {
    console.log('Cleaning up test directory...');
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function runBenchmark() {
  console.log('Starting benchmark...');
  console.time('Total execution');
  
  const initialMemory = process.memoryUsage();
  console.log('Initial memory usage:', {
    heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(initialMemory.heapTotal / 1024 / 1024) + ' MB',
    rss: Math.round(initialMemory.rss / 1024 / 1024) + ' MB'
  });

  console.time('Project generation');
  const testDir = await generateLargeProject();
  console.timeEnd('Project generation');

  const checker = new DuplicateChecker(testDir, {
    memoryLimit: 4 * 1024 * 1024 * 1024, // 4GB for large projects
    maxConcurrentProcesses: 8, // Increase concurrency for better performance
    debug: false // Disable debug logging for benchmark
  });

  console.time('File scanning');
  const files = await checker.findFiles(testDir);
  console.timeEnd('File scanning');
  console.log('Files found:', {
    codeFiles: files.codeFiles.length,
    resourceFiles: files.resourceFiles.length
  });

  console.time('Duplicate analysis');
  console.log('Starting duplicate analysis...');
  const results = await checker.analyzeDuplicates();
  console.timeEnd('Duplicate analysis');
  
  console.log('Analysis complete. Processing results...');

  const peakMemory = process.memoryUsage();
  console.log('Peak memory usage:', {
    heapUsed: Math.round(peakMemory.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(peakMemory.heapTotal / 1024 / 1024) + ' MB',
    rss: Math.round(peakMemory.rss / 1024 / 1024) + ' MB'
  });

  console.log('Results summary:', {
    duplicateFunctions: results.functions.length,
    duplicateModules: results.modules.length,
    duplicateResources: results.resources.length
  });

  console.timeEnd('Total execution');
  
  // Cleanup
  await cleanupTestDir(testDir);
  return results;
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(console.error);
}

export { generateLargeProject, runBenchmark };
