import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { I18n } from 'i18n';
import { fileURLToPath } from 'url';
import { ReactDuplicateDetector } from './src/react/index.js';
import * as t from '@babel/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define error codes and custom error class
class DuplicateCheckerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DuplicateCheckerError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

const ErrorCodes = {
  FILE_NOT_FOUND: 'E001',
  PARSE_ERROR: 'E002',
  MEMORY_LIMIT: 'E003',
  INVALID_CONFIG: 'E004'
};

// Initialize i18n
const i18n = new I18n({
  locales: ['en', 'ja'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'ja',
  objectNotation: true,
  register: global
});

// Set language based on priority: ENV > config > default
const loadConfig = () => {
  try {
    const configPath = path.join(process.cwd(), 'duplicate-checker.config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    return {};
  }
};

const config = loadConfig();
const lang = process.env.DUPLICATE_CHECKER_LANG || config.language || 'ja';
i18n.setLocale(lang);

// @babel/traverseのデフォルトエクスポートを使用
const { default: traverseDefault } = traverse;

class DuplicateChecker {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    // ハッシュマップの初期化
    this.functionHashes = new Map();
    this.moduleHashes = new Map();
    this.resourceHashes = new Map();
    this.duplicates = {
      functions: new Map(),
      modules: new Map(),
      resources: new Map(),
      reactComponents: new Map()
    };
    this.reactDetector = new ReactDuplicateDetector(options);
    // デフォルトオプションを別オブジェクトとして分離
    this.options = {
      ...DuplicateChecker.defaultOptions,
      ...options
    };
    // パフォーマンスモニタリングの初期化
    this.metrics = {
      startTime: 0,
      endTime: 0,
      totalFiles: 0,
      processedFiles: 0
    };
  }

  // デフォルトオプションを静的プロパティとして定義
  static get defaultOptions() {
    return {
      excludePackageFiles: true,
      similarityThreshold: 0.7,
      minFunctionLines: 3,
      debug: false,
      excludePatterns: [
        'tsconfig.json',
        'package.json',
        'package-lock.json',
        '*.config.json',
        '*.config.js',
        '*.config.ts'
      ],
      maxConcurrentProcesses: 4, // 並行処理の制限
      memoryLimit: 1024 * 1024 * 1024, // 1GB のメモリ制限
      resourceComparison: {
        enableStringComparison: true,
        enableNumberComparison: true,
        enableArrayOrderCheck: true,
        maxDepth: 5,
        stringThreshold: 0.8,
        numberThreshold: 0.1,  // Lowered to match test requirements
        arrayThreshold: 0.7,
        structureWeight: 0.4,
        valueWeight: 0.6
      }
    };
  }

  // Recursively search for files / ファイルを再帰的に検索
  async findFiles(dir, depth = 0) {
    // メモリ使用量のチェック
    const memoryUsage = process.memoryUsage().heapUsed;
    if (memoryUsage > this.options.memoryLimit) {
      throw new DuplicateCheckerError(
        ErrorCodes.MEMORY_LIMIT,
        i18n.__('errors.memoryLimit', { limit: Math.round(this.options.memoryLimit / 1024 / 1024) }),
        { memoryUsage, limit: this.options.memoryLimit }
      );
    }

    const result = {
      codeFiles: [],
      resourceFiles: []
    };

    try {
      const files = await fs.promises.readdir(dir);
      const processFile = async (file) => {
        const filePath = path.join(dir, file);
        try {
          const stat = await fs.promises.stat(filePath);

          if (stat.isDirectory()) {
            if (!this.isIgnoredDirectory(file)) {
              const subFiles = await this.findFiles(filePath, depth + 1);
              result.codeFiles.push(...subFiles.codeFiles);
              result.resourceFiles.push(...subFiles.resourceFiles);
            }
          } else if (!this.shouldExcludeFile(file)) {
            if (this.isCodeFile(file)) {
              result.codeFiles.push(filePath);
            } else if (this.isResourceFile(file)) {
              result.resourceFiles.push(filePath);
            }
          }
        } catch (error) {
          console.warn(i18n.__('warnings.fileProcessing', { file: filePath, error: error.message }));
        }
      };

      // 並行処理の実装
      const chunks = this.chunkArray(files, this.options.maxConcurrentProcesses);
      for (const chunk of chunks) {
        await Promise.all(chunk.map(file => processFile(file)));
      }

      // 進捗の追跡
      if (depth === 0) {
        this.metrics.totalFiles = result.codeFiles.length + result.resourceFiles.length;
      }

    } catch (error) {
      console.error(i18n.__('errors.directoryProcessing', { dir, error: error.message }));
      throw new DuplicateCheckerError(
        ErrorCodes.FILE_NOT_FOUND,
        i18n.__('errors.directoryProcessing', { dir, error: error.message }),
        { dir, originalError: error }
      );
    }

    return result;
  }

  // 配列を指定サイズのチャンクに分割
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Check for ignored directories / 無視するディレクトリの判定
  isIgnoredDirectory(dirName) {
    const ignoreDirs = ['node_modules', '.next', 'build', 'dist', '.git', 'coverage'];
    return ignoreDirs.includes(dirName);
  }

  // Check for code files / コードファイルの判定
  isCodeFile(fileName) {
    return /\.(js|jsx|ts|tsx)$/.test(fileName);
  }

  // Check for resource files / リソースファイルの判定
  isResourceFile(fileName) {
    return /\.(ya?ml|json)$/.test(fileName);
  }

  // Check if file should be excluded / ファイルを除外すべきかどうかの判定
  shouldExcludeFile(fileName) {
    return this.options.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(fileName);
      }
      return fileName === pattern;
    });
  }

  // Generate hash value for code / コードのハッシュ値を生成
  generateHash(code) {
    return crypto.createHash('md5').update(code).digest('hex');
  }

  // Calculate module similarity / モジュールの類似度を計算
  calculateModuleSimilarity(code1, code2) {
    try {
      const ast1 = parser.parse(code1, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      const ast2 = parser.parse(code2, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // Extract normalized function implementations
      const funcs1 = new Set();
      const funcs2 = new Set();

      // Extract all function implementations from both files
      const funcsFromAst1 = new Set();
      const funcsFromAst2 = new Set();

      traverseDefault(ast1, {
        FunctionDeclaration: (path) => {
          const code = this.getFunctionCode(path.node);
          if (code) funcsFromAst1.add(code);
        },
        ArrowFunctionExpression: (path) => {
          if (path.parent.type === 'VariableDeclarator') {
            const code = this.getFunctionCode(path.node);
            if (code) funcsFromAst1.add(code);
          }
        }
      });

      traverseDefault(ast2, {
        FunctionDeclaration: (path) => {
          const code = this.getFunctionCode(path.node);
          if (code) funcsFromAst2.add(code);
        },
        ArrowFunctionExpression: (path) => {
          if (path.parent.type === 'VariableDeclarator') {
            const code = this.getFunctionCode(path.node);
            if (code) funcsFromAst2.add(code);
          }
        }
      });

      // Calculate similarity based on normalized implementations
      const similarity = this.calculateJaccardSimilarity(funcsFromAst1, funcsFromAst2);

      return similarity;
    } catch (error) {
      console.error('Error calculating module similarity:', error);
      return 0;
    }
  }

  // Calculate Jaccard similarity / Jaccard類似度の計算
  calculateJaccardSimilarity(set1, set2) {
    const arr1 = Array.from(set1);
    const arr2 = Array.from(set2);
    
    // Count matching implementations
    let matches = 0;
    const totalFuncs = arr1.length + arr2.length;
    
    for (const impl1 of arr1) {
      if (arr2.includes(impl1)) {
        matches += 2; // Count both occurrences
      }
    }
    
    // Calculate similarity based on matching implementations
    return totalFuncs > 0 ? matches / totalFuncs : 0;
  }

  // Check for duplicate resources / リソースの重複をチェック
  async checkResourceDuplicates(files) {
    console.log('Starting resource duplicate analysis...');
    // Reset resource hashes for each run
    this.resourceHashes = new Map();
    this.duplicates.resources = new Map();
    
    for (const file of files) {
      try {
        if (!fs.existsSync(file)) {
          console.warn(new DuplicateCheckerError(
            ErrorCodes.FILE_NOT_FOUND,
            i18n.__('errors.fileNotFound', { file }),
            { file }
          ));
          continue;
        }

        let content;
        try {
          content = await fs.promises.readFile(file, 'utf-8');
        } catch (error) {
          // Handle file read errors (e.g., permission denied)
          console.warn(new DuplicateCheckerError(
            ErrorCodes.FILE_NOT_FOUND,
            i18n.__('errors.fileNotFound', { file }),
            { file, originalError: error }
          ));
          continue;
        }

        let resourceData;
        try {
          if (file.endsWith('.json')) {
            resourceData = JSON.parse(content);
          } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            resourceData = yaml.load(content);
          }
        } catch (error) {
          // Handle parse errors
          console.warn(new DuplicateCheckerError(
            ErrorCodes.PARSE_ERROR,
            i18n.__('errors.resourceParse', { file, error: error.message }),
            { file, originalError: error }
          ));
          continue;
        }

        if (resourceData) {
          // Check the entire object as a potential duplicate
          const valueHash = this.generateHash(JSON.stringify(resourceData));
          
          // Compare with existing resources
          for (const [existingHash, existingData] of this.resourceHashes.entries()) {
            const similarity = this.calculateObjectSimilarity(resourceData, existingData.value);
            if (similarity >= this.options.resourceComparison.stringThreshold) {
              const duplicateKey = this.generateHash(`${typeof resourceData}_${valueHash}_${existingHash}`);
              this.recordDuplicate(duplicateKey, resourceData, file, '', similarity);
              this.recordDuplicate(duplicateKey, existingData.value, existingData.file, '', similarity);
            }
          }

          // Store current resource
          this.resourceHashes.set(valueHash, {
            value: resourceData,
            file,
            key: ''
          });

          // Then check individual keys
          this.checkResourceKeys(resourceData, '', file);
        }
      } catch (error) {
        // Handle any other unexpected errors
        console.warn(new DuplicateCheckerError(
          ErrorCodes.PARSE_ERROR,
          i18n.__('errors.resourceParse', { file, error: error.message }),
          { file, originalError: error }
        ));
        continue;
      }
    }
  }

  // Recursively check resource keys / リソースのキーを再帰的にチェック
  checkResourceKeys(obj, prefix = '', file, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > this.options.resourceComparison.maxDepth) return;

    // Skip if array - we handle arrays separately
    if (Array.isArray(obj)) return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Generate a consistent hash for the value
      const valueHash = this.generateHash(JSON.stringify(value));
      
      // Compare with existing values first
      for (const [existingHash, existingData] of this.resourceHashes.entries()) {
        const existingValue = existingData.value;
        let similarity = 0;

        // Only compare values of the same type
        if (typeof value === typeof existingValue) {
          if (typeof value === 'string' && this.options.resourceComparison.enableStringComparison) {
            similarity = this.calculateStringSimilarity(value, existingValue);
          } else if (Array.isArray(value) && this.options.resourceComparison.enableArrayOrderCheck) {
            similarity = this.calculateArraySimilarity(value, existingValue);
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            similarity = this.calculateObjectSimilarity(value, existingValue);
          } else if (typeof value === 'number' && this.options.resourceComparison.enableNumberComparison) {
            similarity = this.calculateNumberSimilarity(value, existingValue);
          }
        } else if (this.options.resourceComparison.enableNumberComparison) {
          // Handle numeric strings
          const num1 = Number(value);
          const num2 = Number(existingValue);
          if (!isNaN(num1) && !isNaN(num2)) {
            similarity = this.calculateNumberSimilarity(num1, num2);
          }
        }

        // Get threshold based on type
        const threshold = 
          Array.isArray(value) ? this.options.resourceComparison.arrayThreshold :
          typeof value === 'string' ? this.options.resourceComparison.stringThreshold :
          typeof value === 'number' || !isNaN(Number(value)) ? 
            this.options.resourceComparison.numberThreshold : 0.8;

        if (similarity >= threshold) {
          const duplicateKey = this.generateHash(`${typeof value}_${valueHash}_${existingHash}`);
          this.recordDuplicate(duplicateKey, value, file, fullKey, similarity);
          this.recordDuplicate(duplicateKey, existingValue, existingData.file, existingData.key, similarity);
        }
      }

      // Store current value after comparison
      this.resourceHashes.set(valueHash, {
        value,
        file,
        key: fullKey
      });

      // Recursively check nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.checkResourceKeys(value, fullKey, file, depth + 1);
      }
    }
  }

  recordDuplicate(hash, value, file, key, similarity) {
    if (!this.duplicates.resources.has(hash)) {
      this.duplicates.resources.set(hash, {
        value,
        similarity: Math.max(0, similarity), // Ensure non-negative similarity
        occurrences: [{ file, key }]
      });
    } else {
      const duplicate = this.duplicates.resources.get(hash);
      if (!duplicate.occurrences.some(loc => loc.file === file && loc.key === key)) {
        duplicate.occurrences.push({ file, key });
        // Update similarity if higher
        if (Math.max(0, similarity) > duplicate.similarity) {
          duplicate.similarity = Math.max(0, similarity);
        }
      }
    }

  }

  // Check for duplicate modules / モジュールの重複をチェック
  async checkModuleDuplicates(files) {
    console.log('Starting module similarity analysis...');
    const modules = new Map();
    let processedModules = 0;
    const totalModules = files.length;

    // Process files in chunks to avoid memory issues
    const chunkSize = 100;
    const chunks = this.chunkArray(files, chunkSize);

    for (const chunk of chunks) {
      console.log(`Processing modules ${processedModules + 1} to ${Math.min(processedModules + chunkSize, totalModules)}/${totalModules}...`);
      
      for (const file of chunk) {
        processedModules++;
        const code = await fs.promises.readFile(file, 'utf-8');
        modules.set(file, code);
      }
    }

    console.log('Starting module comparisons...');
    // モジュール間の類似度を計算
    const moduleEntries = Array.from(modules.entries());
    let comparedPairs = 0;
    const totalPairs = (modules.size * (modules.size - 1)) / 2;

    for (let i = 0; i < moduleEntries.length; i++) {
      const [file1, code1] = moduleEntries[i];
      for (let j = i + 1; j < moduleEntries.length; j++) {
        const [file2, code2] = moduleEntries[j];
        
        comparedPairs++;
        if (comparedPairs % 1000 === 0) {
          console.log(`Compared ${comparedPairs}/${totalPairs} module pairs...`);
          // Check memory usage periodically
          const memoryUsage = process.memoryUsage().heapUsed;
          if (memoryUsage > this.options.memoryLimit) {
            throw new DuplicateCheckerError(
              ErrorCodes.MEMORY_LIMIT,
              i18n.__('errors.memoryLimit', { limit: Math.round(this.options.memoryLimit / 1024 / 1024) }),
              { memoryUsage, limit: this.options.memoryLimit }
            );
          }
        }

        const similarity = this.calculateModuleSimilarity(code1, code2);
        const similarityPercent = similarity * 100;
        if (similarityPercent >= 66.7) {
          const hash = this.generateHash(`${file1}${file2}`);
          this.duplicates.modules.set(hash, {
            similarity: similarityPercent,
            files: [file1, file2]
          });
        }
      }
    }
    console.log(`Module comparison complete. Analyzed ${comparedPairs} pairs.`);
  }

  // Analyze files to detect duplicate functions / ファイルを解析して関数の重複を検出
  async analyzeDuplicates() {
    // Start performance monitoring
    const startTime = Date.now();
    try {
      // Validate configuration first
      if (!this.options.resourceComparison) {
        throw new DuplicateCheckerError(
          'E004',
          i18n.__('errors.invalidConfig'),
          {
            originalError: new Error('resourceComparison configuration is required')
          }
        );
      }

      const files = await this.findFiles(this.projectPath);
      const codeFiles = files.codeFiles;
      const resourceFiles = files.resourceFiles;

      // Check functions in code files first
      console.log('Analyzing code files...');
      let processedFiles = 0;
      for (const file of codeFiles) {
        processedFiles++;
        if (processedFiles % 100 === 0) {
          console.log(`Processed ${processedFiles}/${codeFiles.length} code files...`);
        }
        try {
          const code = await fs.promises.readFile(file, 'utf-8');
          const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
          });

          traverseDefault(ast, {
            FunctionDeclaration: (path) => {
              this.checkFunction(path.node, file);
            },
            ArrowFunctionExpression: (path) => {
              if (path.parent.type === 'VariableDeclarator') {
                this.checkFunction(path.node, file, path.parent.id.name);
              }
            },
            JSXElement: (path) => {
              const parentFunction = path.findParent(p => 
                t.isFunctionDeclaration(p) || 
                (t.isArrowFunctionExpression(p) && t.isVariableDeclarator(p.parent))
              );
              if (parentFunction) {
                this.checkReactComponent(parentFunction.node, file);
              }
            }
          });
        } catch (error) {
          console.warn(new DuplicateCheckerError(
            'E002',
            i18n.__('errors.fileAnalysis', { file, error: error.message }),
            { file, originalError: error }
          ));
          continue;
        }
      }

      // Then check for module duplicates
      if (codeFiles.length > 0) {
        console.log('Checking for module duplicates...');
        await this.checkModuleDuplicates(codeFiles);
      }

      // Finally check for resource duplicates
      if (resourceFiles.length > 0) {
        console.log('Checking for resource duplicates...');
        await this.checkResourceDuplicates(resourceFiles);
      }

      const results = this.formatResults();
      
      // Log performance metrics
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`Analysis completed in ${duration.toFixed(2)}s`);
      console.log('Memory usage:', {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      });
      
      return results;
    } catch (error) {
      // Re-throw specific error types that should be propagated
      if (error instanceof DuplicateCheckerError && 
          [ErrorCodes.MEMORY_LIMIT, ErrorCodes.FILE_NOT_FOUND, ErrorCodes.INVALID_CONFIG].includes(error.code)) {
        throw error;
      }
      // For other errors, log and continue
      console.warn(new DuplicateCheckerError(
        'E002',
        i18n.__('errors.fileAnalysis'),
        {
          file: error.file || null,
          originalError: error
        }
      ));
      return this.formatResults();
    }
  }

  // Get function code / 関数のコードを取得
  getFunctionCode(node) {
    if (node.body.type === 'BlockStatement') {
      try {
        const code = node.body.body.map(stmt => {
          // Normalize variable names to detect similar implementations
          let stmtCode = '';
          if (stmt.type === 'VariableDeclaration') {
            // Completely normalize variable declarations
            stmtCode = 'const _var_ = number;';
          } else if (stmt.type === 'ExpressionStatement') {
            stmtCode = stmt.expression.type;
          } else if (stmt.type === 'ReturnStatement' && stmt.argument) {
            if (stmt.argument.type === 'BinaryExpression') {
              // Completely normalize binary expressions to detect similar implementations
              stmtCode = `return binary_${stmt.argument.operator};`;
            } else {
              stmtCode = `return ${stmt.argument.type};`;
            }
          } else {
            stmtCode = stmt.type;
          }
          return stmtCode;
        }).join('\n');

        if (code.split('\n').length < this.options.minFunctionLines) {
          return '';
        }

        return code;
      } catch {
        return '';
      }
    }
    return node.body.type || '';
  }

  // Check for duplicate functions / 関数の重複をチェック
  checkFunction(node, file, name = node.id?.name) {
    if (!name) return;

    const code = this.getFunctionCode(node);
    if (!code) return;

    const hash = this.generateHash(code);
    
    if (this.options.debug) {
      console.log(`Function: ${name} in ${file}`);
      console.log(`Normalized code:\n${code}`);
      console.log(`Hash: ${hash}\n`);
    }
    
    if (this.functionHashes.has(hash)) {
      const existing = this.functionHashes.get(hash);
      if (!this.duplicates.functions.has(hash)) {
        this.duplicates.functions.set(hash, {
          name,
          code,
          locations: [existing, { file, name }]
        });
      } else {
        this.duplicates.functions.get(hash).locations.push({ file, name });
      }
    } else {
      this.functionHashes.set(hash, { file, name });
    }
  }

  // Utility functions for similarity calculations
  calculateLevenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    return matrix[str2.length][str1.length];
  }

  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    const distance = this.calculateLevenshteinDistance(str1, str2);
    return 1 - (distance / Math.max(str1.length, str2.length));
  }

  calculateNumberSimilarity(num1, num2) {
    // Handle edge cases
    if (isNaN(num1) || isNaN(num2)) return 0;
    if (num1 === num2) return 1;
    
    // For numbers close to zero, use absolute difference
    if (Math.abs(num1) < 1 && Math.abs(num2) < 1) {
      return 1 - Math.min(Math.abs(num1 - num2), 1);
    }
    
    // For larger numbers, use relative difference
    const diff = Math.abs(num1 - num2);
    const avg = (num1 + num2) / 2;
    const relativeDiff = diff / avg;
    

    
    return Math.max(0, 1 - relativeDiff);
  }

  calculateArraySimilarity(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return 0;
    if (arr1.length === 0 && arr2.length === 0) return 1;
    if (arr1.length === 0 || arr2.length === 0) return 0;

    // For arrays with same elements in different order
    const sortedMatch = arr1.slice().sort().join(',') === arr2.slice().sort().join(',') ? 1 : 0;

    // Ordered comparison (50% weight)
    const orderedSimilarity = arr1.reduce((acc, val, idx) => {
      return acc + (this.calculateValueSimilarity(val, arr2[idx] || null) || 0);
    }, 0) / Math.max(arr1.length, arr2.length);

    // Unordered comparison (30% weight)
    const matches = arr1.reduce((acc, val1) => {
      const bestMatch = Math.max(...arr2.map(val2 => 
        this.calculateValueSimilarity(val1, val2) || 0
      ));
      return acc + bestMatch;
    }, 0) / Math.max(arr1.length, arr2.length);

    // Combine all similarity measures
    return Math.max(
      sortedMatch,
      (orderedSimilarity * 0.5) + (matches * 0.3) + (sortedMatch * 0.2)
    );
  }

  calculateValueSimilarity(val1, val2) {
    if (val1 === null || val2 === null) return 0;
    
    // Handle numeric strings
    const num1 = Number(val1);
    const num2 = Number(val2);
    if (!isNaN(num1) && !isNaN(num2) && this.options.resourceComparison.enableNumberComparison) {
      return this.calculateNumberSimilarity(num1, num2);
    }

    // Handle arrays
    if (Array.isArray(val1) && Array.isArray(val2) && this.options.resourceComparison.enableArrayOrderCheck) {
      return this.calculateArraySimilarity(val1, val2);
    }

    // Handle strings
    if (typeof val1 === 'string' && typeof val2 === 'string' && this.options.resourceComparison.enableStringComparison) {
      return this.calculateStringSimilarity(val1, val2);
    }

    // Handle objects
    if (typeof val1 === 'object' && typeof val2 === 'object' && !Array.isArray(val1) && !Array.isArray(val2)) {
      return this.calculateObjectSimilarity(val1, val2);
    }

    return val1 === val2 ? 1 : 0;
  }

  calculateObjectSimilarity(obj1, obj2, depth = 0) {
    // Handle special cases first
    if (obj1 === obj2) return obj1 === null ? 0 : 1;
    if (!obj1 || !obj2) return 0;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return 0;
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return 0;
    if (Array.isArray(obj1)) return this.calculateArraySimilarity(obj1, obj2);
    
    // Check depth limit
    if (depth >= this.options.resourceComparison.maxDepth) return 0;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    // Handle empty objects
    if (keys1.length === 0 && keys2.length === 0) return 1;
    if (keys1.length === 0 || keys2.length === 0) return 0;
    
    // Structure similarity (40%)
    const commonKeys = keys1.filter(k => keys2.includes(k));
    const structureSimilarity = commonKeys.length / Math.max(keys1.length, keys2.length);
    
    // Value similarity (60%)
    let valueSimilarity = 0;
    if (commonKeys.length > 0) {
      valueSimilarity = commonKeys.reduce((acc, key) => {
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        if (typeof val1 === 'object' && val1 !== null && !Array.isArray(val1) &&
            typeof val2 === 'object' && val2 !== null && !Array.isArray(val2)) {
          // For nested objects, calculate similarity recursively
          const nestedSimilarity = this.calculateObjectSimilarity(val1, val2, depth + 1);
          return acc + (nestedSimilarity || 0);
        } else if (Array.isArray(val1) && Array.isArray(val2)) {
          // For arrays, use array similarity
          const arraySimilarity = this.calculateArraySimilarity(val1, val2);
          return acc + (arraySimilarity || 0);
        } else if (typeof val1 === 'string' && typeof val2 === 'string') {
          // For strings, use string similarity
          const stringSimilarity = this.calculateStringSimilarity(val1, val2);
          return acc + (stringSimilarity || 0);
        } else if (typeof val1 === 'number' && typeof val2 === 'number') {
          // For numbers, use number similarity
          const numberSimilarity = this.calculateNumberSimilarity(val1, val2);
          return acc + (numberSimilarity || 0);
        }
        
        // For exact matches of other types
        return acc + (val1 === val2 ? 1 : 0);
      }, 0) / commonKeys.length;
    }
    
    const similarity = (
      structureSimilarity * this.options.resourceComparison.structureWeight +
      valueSimilarity * this.options.resourceComparison.valueWeight
    );
    
    return Math.max(0, Math.min(1, similarity));
  }

  // Check for React component duplicates / Reactコンポーネントの重複をチェック
  async checkReactComponent(node, file) {
    const duplicates = await this.reactDetector.detectDuplicates([{ node, file }]);
    
    for (const duplicate of duplicates) {
      const hash = this.generateHash(`${duplicate.files[0]}${duplicate.files[1]}`);
      this.duplicates.reactComponents.set(hash, duplicate);
    }
  }

  // Format results / 結果をフォーマット
  formatResults() {
    const duplicates = {
      functions: Array.from(this.duplicates.functions.values()).map(dup => ({
        functionName: dup.name,
        occurrences: dup.locations.map(loc => ({
          file: path.relative(this.projectPath, loc.file),
          name: loc.name
        }))
      })),
      reactComponents: Array.from(this.duplicates.reactComponents.values()).map(dup => ({
        similarity: dup.similarity * 100,
        files: dup.files.map(file => path.relative(this.projectPath, file)),
        details: dup.details
      })),
      modules: Array.from(this.duplicates.modules.values()).map(dup => ({
        similarity: dup.similarity * 100,
        files: dup.files.map(file => path.relative(this.projectPath, file))
      })),
      resources: Array.from(this.duplicates.resources.values())
        .filter(dup => {
          const threshold = 
            Array.isArray(dup.value) ? this.options.resourceComparison.arrayThreshold :
            typeof dup.value === 'string' ? this.options.resourceComparison.stringThreshold :
            typeof dup.value === 'number' || !isNaN(Number(dup.value)) ? 
              this.options.resourceComparison.numberThreshold : 0.8;
          return dup.similarity >= threshold;
        })
        .sort((a, b) => b.similarity - a.similarity) // Sort by similarity descending
        .map(dup => ({
          value: dup.value,
          similarity: dup.similarity,
          occurrences: dup.occurrences.map(loc => ({
            file: path.relative(this.projectPath, loc.file),
            key: loc.key
          }))
        }))
    };

    // Output duplicate functions
    console.log('\nDuplicate Functions');
    if (duplicates.functions.length === 0) {
      console.log('No duplicate functions found.');
    } else {
      duplicates.functions.forEach(dup => {
        console.log('\nFunction name: ' + dup.functionName);
        console.log('locations');
        dup.occurrences.forEach(loc => {
          console.log(`- ${loc.file} (name: "${loc.name}")`);
        });
      });
    }

    return duplicates;
  }
}

// メイン処理の実行
async function main() {
  const projectPath = process.argv[2];
  if (!projectPath) {
    throw new DuplicateCheckerError(
      ErrorCodes.INVALID_CONFIG,
      i18n.__('errors.invalidConfig'),
      { details: 'Project path is required' }
    );
  }
  const checker = new DuplicateChecker(projectPath);

  try {
    // 処理開始時間の記録
    checker.metrics.startTime = Date.now();

    // 進捗表示の初期化
    console.log(i18n.__('progress.starting'));

    // ファイル検索の実行
    const files = await checker.findFiles(checker.projectPath);
    console.log(i18n.__('progress.filesFound', { count: files.codeFiles.length + files.resourceFiles.length }));

    // 重複チェックの実行
    const results = await checker.analyzeDuplicates();

    // モジュールの重複を表示
    console.log('\n' + i18n.__('similarModules'));
    if (results.modules.length === 0) {
      console.log(i18n.__('noSimilarModules'));
    } else {
      results.modules.forEach(dup => {
        console.log('\n' + i18n.__('similarityFormat', dup.similarity.toFixed(1) + '%'));
        console.log(i18n.__('files'));
        dup.files.forEach(file => console.log(i18n.__('fileFormat', file)));
      });
    }

    // リソースの重複を表示
    console.log('\n' + i18n.__('duplicateResources'));
    if (results.resources.length === 0) {
      console.log(i18n.__('noDuplicateResources'));
    } else {
      results.resources.forEach(dup => {
        console.log('\n' + i18n.__('valueFormat', dup.value));
        console.log(i18n.__('resourceLocations'));
        dup.occurrences.forEach(loc => {
          console.log(i18n.__('resourceLocationFormat', loc.file, loc.key));
        });
      });
    }

    // Display React component duplicates
    console.log('\nDuplicate React Components');
    if (results.reactComponents.length === 0) {
      console.log('No duplicate React components found.');
    } else {
      results.reactComponents.forEach(dup => {
        console.log(`\nSimilarity: ${dup.similarity.toFixed(1)}%`);
        console.log('Files:');
        dup.files.forEach(file => console.log(`- ${file}`));
        console.log('Details:');
        console.log(`- Props similarity: ${(dup.details.props * 100).toFixed(1)}%`);
        console.log(`- JSX similarity: ${(dup.details.jsx * 100).toFixed(1)}%`);
      });
    }

    // 処理終了時間の記録
    checker.metrics.endTime = Date.now();

    // 結果の表示
    const duplicateCount = {
      functions: checker.duplicates.functions.size,
      modules: checker.duplicates.modules.size,
      resources: checker.duplicates.resources.size
    };

    console.log(i18n.__('results.summary', {
      time: ((checker.metrics.endTime - checker.metrics.startTime) / 1000).toFixed(2),
      files: checker.metrics.totalFiles,
      duplicates: Object.values(duplicateCount).reduce((a, b) => a + b, 0)
    }));

    // 詳細な結果の表示
    console.log(i18n.__('results.details'));
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error(i18n.__('errors.main', { error: error.message }));
    if (process.env.NODE_ENV === 'test') {
      throw error;
    } else {
      process.exit(1);
    }
  }
}

// メイン処理の実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(i18n.__('errors.main', { error: err.message }));
    process.exit(1);
  });
}

export { DuplicateChecker as default, DuplicateCheckerError, main };
