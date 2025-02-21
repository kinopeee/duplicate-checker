import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { I18n } from 'i18n';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    this.functionHashes = new Map();
    this.moduleHashes = new Map();
    this.resourceHashes = new Map();
    this.duplicates = {
      functions: new Map(),
      modules: new Map(),
      resources: new Map()
    };
    this.options = {
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
      ...options
    };
  }

  // Recursively search for files / ファイルを再帰的に検索
  async findFiles(dir) {
    const files = await fs.promises.readdir(dir);
    const result = {
      codeFiles: [],
      resourceFiles: []
    };

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        if (!this.isIgnoredDirectory(file)) {
          const subFiles = await this.findFiles(filePath);
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
    }

    return result;
  }

  // Check for ignored directories / 無視するディレクトリの判定
  isIgnoredDirectory(dirName) {
    const ignoreDirs = ['node_modules', '.next', 'build', 'dist', '.git'];
    return ignoreDirs.includes(dirName);
  }

  // Check for code files / コードファイルの判定
  isCodeFile(fileName) {
    return /\.(js|jsx|ts|tsx)$/.test(fileName);
  }

  // Check for resource files / リソースファイルの判定
  isResourceFile(fileName) {
    return /\.(ya?ml)$/.test(fileName);
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
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        let resourceData;

        if (file.endsWith('.json')) {
          resourceData = JSON.parse(content);
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          resourceData = yaml.load(content);
        }

        if (resourceData) {
          // リソースの各キーごとに重複チェック
          this.checkResourceKeys(resourceData, '', file);
        }
      } catch (err) {
        console.error(__('error.resourceParsing', { file }), err);
      }
    }
  }

  // Recursively check resource keys / リソースのキーを再帰的にチェック
  checkResourceKeys(obj, prefix, file, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > this.options.resourceComparison.maxDepth) return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          const hash = this.generateHash(JSON.stringify(value));
          const cacheKey = `array_${hash}`;
          
          if (this.resourceHashes.has(cacheKey)) {
            const existing = this.resourceHashes.get(cacheKey);
            const similarity = this.calculateArraySimilarity(value, existing.value);
            
            if (similarity >= this.options.resourceComparison.arrayThreshold) {
              this.recordDuplicate(cacheKey, value, file, fullKey, similarity);
            }
          } else {
            this.resourceHashes.set(cacheKey, { file, key: fullKey, value });
          }
        } else {
          this.checkResourceKeys(value, fullKey, file, depth + 1);
        }
      } else {
        const valueType = typeof value;
        const hash = this.generateHash(String(value));
        const cacheKey = `${valueType}_${hash}`;
        
        if (this.resourceHashes.has(cacheKey)) {
          const existing = this.resourceHashes.get(cacheKey);
          let similarity = 0;
          
          if (valueType === 'string' && this.options.resourceComparison.enableStringComparison) {
            similarity = this.calculateStringSimilarity(value, existing.value);
          } else if (valueType === 'number' && this.options.resourceComparison.enableNumberComparison) {
            similarity = this.calculateNumberSimilarity(value, existing.value);
          } else {
            similarity = value === existing.value ? 1 : 0;
          }
          
          const threshold = valueType === 'string' ? this.options.resourceComparison.stringThreshold :
                          valueType === 'number' ? this.options.resourceComparison.numberThreshold : 1;
          
          if (similarity >= threshold) {
            this.recordDuplicate(cacheKey, value, file, fullKey, similarity);
          }
        } else {
          this.resourceHashes.set(cacheKey, { file, key: fullKey, value });
        }
      }
    }
  }

  recordDuplicate(hash, value, file, key, similarity) {
    if (!this.duplicates.resources.has(hash)) {
      const existing = this.resourceHashes.get(hash);
      this.duplicates.resources.set(hash, {
        value,
        similarity,
        locations: [
          { file: existing.file, key: existing.key },
          { file, key }
        ]
      });
    } else {
      this.duplicates.resources.get(hash).locations.push({ file, key });
    }
  }

  // Check for duplicate modules / モジュールの重複をチェック
  async checkModuleDuplicates(files) {
    const modules = new Map();

    for (const file of files) {
      const code = await fs.promises.readFile(file, 'utf-8');
      modules.set(file, code);
    }

    // モジュール間の類似度を計算
    for (const [file1, code1] of modules) {
      for (const [file2, code2] of modules) {
        if (file1 >= file2) continue; // 重複チェックを避ける

        const similarity = this.calculateModuleSimilarity(code1, code2);
        // Lower the threshold since we're using normalized implementations
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
  }

  // Analyze files to detect duplicate functions / ファイルを解析して関数の重複を検出
  async analyzeDuplicates() {
    const { codeFiles, resourceFiles } = await this.findFiles(this.projectPath);

    // 関数の重複チェック
    for (const file of codeFiles) {
      const code = await fs.promises.readFile(file, 'utf-8');

      try {
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
        });
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }

    // モジュールの重複チェック
    await this.checkModuleDuplicates(codeFiles);

    // リソースの重複チェック
    await this.checkResourceDuplicates(resourceFiles);

    return this.formatResults();
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
    const distance = this.calculateLevenshteinDistance(str1, str2);
    return 1 - (distance / Math.max(str1.length, str2.length));
  }

  calculateNumberSimilarity(num1, num2) {
    const relativeDiff = Math.abs(num1 - num2) / Math.max(Math.abs(num1), Math.abs(num2));
    return 1 - relativeDiff;
  }

  calculateArraySimilarity(arr1, arr2) {
    // Ordered comparison (70% weight)
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

    return (orderedSimilarity * 0.7) + (matches * 0.3);
  }

  calculateValueSimilarity(val1, val2) {
    if (val1 === null || val2 === null) return 0;
    if (typeof val1 !== typeof val2) return 0;

    const type = typeof val1;
    if (type === 'string' && this.options.resourceComparison.enableStringComparison) {
      return this.calculateStringSimilarity(val1, val2);
    }
    if (type === 'number' && this.options.resourceComparison.enableNumberComparison) {
      return this.calculateNumberSimilarity(val1, val2);
    }
    if (Array.isArray(val1) && this.options.resourceComparison.enableArrayOrderCheck) {
      return this.calculateArraySimilarity(val1, val2);
    }
    if (type === 'object') {
      return this.calculateObjectSimilarity(val1, val2);
    }
    return val1 === val2 ? 1 : 0;
  }

  calculateObjectSimilarity(obj1, obj2, depth = 0) {
    if (depth >= this.options.resourceComparison.maxDepth) return 0;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    // Structure similarity (40%)
    const structureSimilarity = 
      keys1.filter(k => keys2.includes(k)).length / 
      Math.max(keys1.length, keys2.length);
    
    // Value similarity (60%)
    const commonKeys = keys1.filter(k => keys2.includes(k));
    const valueSimilarity = commonKeys.reduce((acc, key) => {
      return acc + (this.calculateValueSimilarity(obj1[key], obj2[key], depth + 1) || 0);
    }, 0) / Math.max(keys1.length, keys2.length);
    
    return (structureSimilarity * this.options.resourceComparison.structureWeight) +
           (valueSimilarity * this.options.resourceComparison.valueWeight);
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
      modules: Array.from(this.duplicates.modules.values()).map(dup => ({
        similarity: dup.similarity * 100,
        files: dup.files.map(file => path.relative(this.projectPath, file))
      })),
      resources: Array.from(this.duplicates.resources.values()).map(dup => ({
        value: dup.value,
        occurrences: dup.locations.map(loc => ({
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

// Execute main process / メイン処理の実行
const projectPath = process.argv[2] || '.';
const checker = new DuplicateChecker(projectPath);

checker.analyzeDuplicates()
  .then(duplicates => {
    // Results are already output in formatResults

    // Module duplicates
    console.log('\n' + __('similarModules'));
    if (duplicates.modules.length === 0) {
      console.log(__('noSimilarModules'));
    } else {
      duplicates.modules.forEach(dup => {
        console.log('\n' + __('similarityFormat', dup.similarity.toFixed(1) + '%'));
        console.log(__('files'));
        dup.files.forEach(file => console.log(__('fileFormat', file)));
      });
    }

    // Resource duplicates
    console.log('\n' + __('duplicateResources'));
    if (duplicates.resources.length === 0) {
      console.log(__('noDuplicateResources'));
    } else {
      duplicates.resources.forEach(dup => {
        console.log('\n' + __('valueFormat', dup.value));
        console.log(__('resourceLocations'));
        dup.occurrences.forEach(loc => {
          console.log(__('resourceLocationFormat', loc.file, loc.key));
        });
      });
    }
  })
  .catch(err => {
    console.error(__('error.occurred'), err);
    process.exit(1);
  });

export default DuplicateChecker;
