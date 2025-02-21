# Duplicate Code Checker

A static analysis tool for detecting code and resource duplicates in projects.

## Features

- Function duplicate detection (normalized implementation comparison)
- Module similarity checking (Jaccard similarity analysis)
- Duplicate value detection in resource files (JSON/YAML)
- Memory optimization for large projects
- Configurable similarity thresholds
- Multilingual support (Japanese/English)
- Concurrent processing for fast analysis
- Detailed progress reporting

## Installation

```bash
npm install
```

Required dependencies:
- @babel/parser: Code analysis
- @babel/traverse: AST traversal
- js-yaml: YAML file processing
- i18n: Multilingual support

## Configuration Options
| Option | Type | Default | Description |
|------------|------|------------|------|
| memoryLimit | number | 1GB | Maximum memory usage |
| maxConcurrentProcesses | number | 4 | Maximum concurrent processes |
| debug | boolean | false | Debug mode |
| minFunctionLines | number | 3 | Minimum function lines |
| resourceComparison.stringThreshold | number | 0.8 | String similarity threshold |
| resourceComparison.numberThreshold | number | 0.1 | Number similarity threshold |
| resourceComparison.arrayThreshold | number | 0.7 | Array similarity threshold |
| resourceComparison.maxDepth | number | 5 | Maximum object traversal depth |

## Test Framework
### Test Framework
- Jest: Modern JavaScript test framework
  - Native ES Modules support
  - Advanced mocking capabilities
  - Detailed coverage reporting

### Coverage Goals
| Metric | Target | Current |
|------------|--------|------|
| Branch | 80% | 80.87% |
| Functions | 80% | 86.88% |
| Lines | 80% | 89.05% |
| Statements | 80% | 87.69% |

### Test Cases
| Category | Test Content | Expected Result |
|----------|------------|----------------|
| Function Duplicates | Normalized implementation comparison | Marked as duplicate if similarity ≥ 0.8 |
| Module Similarity | Jaccard similarity analysis | Marked as similar if similarity ≥ 0.7 |
| Resource Duplicates | Nested object comparison | Consider structure and value similarity |
| Error Handling | Memory limits, file not found, etc. | Proper error codes and recovery |
| Multilingual | Japanese/English error messages | Language switching based on environment |

### Running Tests
```bash
# Run normal tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run benchmark tests
npm run benchmark
```

## Project Structure

```
.
├── duplicate-checker.js      # Main script
├── duplicate-checker.config.json  # Duplicate checker configuration
├── tsconfig.json            # TypeScript configuration
└── locales/                 # Language files
    ├── en.json             # English translations
    └── ja.json             # Japanese translations
```

## Usage

```bash
node duplicate-checker.js [project_path]
```

If no project path is specified, the current directory will be checked.

## Language Configuration

The tool supports both English and Japanese languages. Language selection follows this priority:

1. Environment variable: `DUPLICATE_CHECKER_LANG`
   ```bash
   DUPLICATE_CHECKER_LANG=en node duplicate-checker.js
   ```

2. Configuration file (`duplicate-checker.config.json`):
   ```json
   {
     "language": "en"
   }
   ```

3. Default: Japanese (for backward compatibility)

## Duplicate Check Configuration

### duplicate-checker.config.json

Configuration file to customize the duplicate checker's behavior:

```json
{
  "moduleSimilarityThreshold": 0.7,
  "ignoredResourceKeys": [
    "description",
    "altText"
  ],
  "targetExtensions": [
    ".js",
    ".ts",
    ".yaml"
  ],
  "excludePatterns": [
    "tsconfig.json",
    "package.json",
    "*.config.json",
    "*.config.js",
    "*.config.ts"
  ],
  "language": "en"
}
```

- `moduleSimilarityThreshold`: Module similarity threshold (0.0 to 1.0)
- `ignoredResourceKeys`: Keys to ignore during resource checking
- `targetExtensions`: Target file extensions for checking
- `excludePatterns`: Files to exclude from duplicate checking (supports glob patterns)
- `language`: Interface language (en/ja)

> Note: Configuration files (tsconfig.json, package.json, *.config.json, etc.) are excluded from duplicate checking by default. These files often contain similar configurations that serve different purposes.

## Detection Targets

### 1. Function Duplicates
- Detects functions with identical implementations
- Only functions with minimum lines (default: 3 lines) are checked
- Detects implementation matches regardless of function names or locations

### 2. Module Similarity
- Calculates similarity between files
- Default similarity threshold: 70% or higher
- Uses Jaccard similarity algorithm

### 3. Resource Duplicates
- Detects duplicate values in YAML files
- Supports nested objects
- Reports duplicates with their key paths

## Output Format

```
Duplicate functions:
Function name: [function_name]
Locations:
- [file_path] (name: "[function_name]")

Similar modules:
Similarity: [similarity]%
Files:
- [file_path1]
- [file_path2]

Duplicate resources:
Value: [duplicate_value]
Locations:
- [file_path] (key: "[key_path]")
```

## Excluded Directories

The following directories are automatically excluded:
- node_modules
- .next
- build
- dist
- .git

## Project Configuration (Reference)

This tool is designed for use with TypeScript projects. Here's the recommended TypeScript configuration:

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

## Memory Usage Guidelines
Recommended memory limits based on project size:

- Under 1000 files: 1GB
- 1000-5000 files: 2GB
- Over 5000 files: 4GB

## Error Handling
Error handling with `DuplicateCheckerError` class:

| Error Code | Description | Resolution |
|-------------|------|----------|
| E001 | File not found | Verify the specified path |
| E002 | Parse error | Check file syntax |
| E003 | Memory limit exceeded | Increase memoryLimit or split analysis |
| E004 | Invalid configuration | Check configuration options |

## Troubleshooting

### Memory Limit Exceeded
- Increase memoryLimit option
- Reduce maxConcurrentProcesses
- Split analysis into smaller units

### Parse Errors
- Check file encoding
- Verify source file syntax
- Enable debug mode for detailed logs

### Performance Optimization
- Adjust maxConcurrentProcesses for concurrent processing
- Tune resource comparison thresholds
- Add unnecessary files to exclude patterns

## Performance Guidelines

### Memory Usage Optimization
- Memory leak prevention using WeakMap
  - Used for function and module hash management
  - Garbage collection optimization
- Large file handling with stream processing
  - Efficient file reading
  - Memory usage control
- Dynamic concurrent process adjustment
  - Automatic adjustment based on system resources
  - Control based on memory usage

### Processing Speed Improvements
- File batch processing: 1000 files per batch
  - Speed up through concurrent processing
  - Memory usage leveling
- Search optimization through indexing
  - Faster duplicate detection
  - More efficient similarity calculation
- Avoiding unnecessary comparisons with early returns
  - Pre-filtering using similarity thresholds
  - Skipping comparisons on type mismatches

### Benchmark Results
| File Count | Execution Time | Memory Usage | Processing Speed |
|------------|----------|--------------|----------|
| 1,000 | 1:57 | 175MB | 8.5 files/sec |
| 5,000 | 9:45 | 850MB | 8.6 files/sec |
| 10,000 | 19:30 | 1.7GB | 8.5 files/sec |

> Note: Benchmark results may vary by environment.
> Above results were measured on an 8-core CPU with 16GB memory.

## Notes

- Supports TypeScript/JSX files
- Analysis may take time for large projects
- Skips files with parse errors and continues processing
- Compatible with Next.js projects and follows TypeScript configuration
- Monitor memory usage and adjust settings as needed
- For large projects, properly configuring concurrent processes can reduce processing time
