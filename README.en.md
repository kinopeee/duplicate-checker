# Duplicate Code Checker

A static analysis tool for detecting code and resource duplicates in projects.

## Features

- Function duplicate detection
- Module similarity checking
- Duplicate value detection in resource files (JSON/YAML)

## Installation

```bash
npm install
```

Required dependencies:
- @babel/parser
- @babel/traverse
- js-yaml
- i18n

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

## Notes

- Supports TypeScript/JSX files
- Analysis may take time for large projects
- Skips files with parse errors and continues processing
- Compatible with Next.js projects and follows TypeScript configuration
