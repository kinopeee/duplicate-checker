import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import crypto from 'crypto';
import yaml from 'js-yaml';

// @babel/traverseのデフォルトエクスポートを使用
const { default: traverseDefault } = traverse;

class DuplicateChecker {
  constructor(projectPath) {
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
      minFunctionLines: 3
    };
  }

  // ファイルを再帰的に検索
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
      } else {
        if (this.isCodeFile(file)) {
          result.codeFiles.push(filePath);
        } else if (this.isResourceFile(file) && !this.shouldExcludeFile(file)) {
          result.resourceFiles.push(filePath);
        }
      }
    }

    return result;
  }

  // 無視するディレクトリの判定
  isIgnoredDirectory(dirName) {
    const ignoreDirs = ['node_modules', '.next', 'build', 'dist', '.git'];
    return ignoreDirs.includes(dirName);
  }

  // コードファイルの判定
  isCodeFile(fileName) {
    return /\.(js|jsx|ts|tsx)$/.test(fileName);
  }

  // リソースファイルの判定
  isResourceFile(fileName) {
    return /\.(json|ya?ml)$/.test(fileName);
  }

  // ファイルを除外すべきかどうかの判定
  shouldExcludeFile(fileName) {
    if (!this.options.excludePackageFiles) return false;
    return fileName === 'package.json' || fileName === 'package-lock.json';
  }

  // コードのハッシュ値を生成
  generateHash(code) {
    return crypto.createHash('md5').update(code).digest('hex');
  }

  // モジュールの類似度を計算
  calculateModuleSimilarity(code1, code2) {
    const lines1 = code1.split('\n').filter(line => line.trim());
    const lines2 = code2.split('\n').filter(line => line.trim());

    const similarity = this.calculateJaccardSimilarity(
      new Set(lines1),
      new Set(lines2)
    );

    return similarity;
  }

  // Jaccard類似度の計算
  calculateJaccardSimilarity(set1, set2) {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  // リソースの重複をチェック
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
        console.error(`リソースファイル ${file} の解析中にエラーが発生しました:`, err);
      }
    }
  }

  // リソースのキーを再帰的にチェック
  checkResourceKeys(obj, prefix, file) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.checkResourceKeys(value, fullKey, file);
      } else {
        const hash = this.generateHash(String(value));

        if (this.resourceHashes.has(hash)) {
          const existing = this.resourceHashes.get(hash);
          if (!this.duplicates.resources.has(hash)) {
            this.duplicates.resources.set(hash, {
              value,
              locations: [
                { file: existing.file, key: existing.key },
                { file, key: fullKey }
              ]
            });
          } else {
            this.duplicates.resources.get(hash).locations.push({ file, key: fullKey });
          }
        } else {
          this.resourceHashes.set(hash, { file, key: fullKey });
        }
      }
    }
  }

  // モジュールの重複をチェック
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
        if (similarity > 0.7) { // 類似度閾値
          const hash = this.generateHash(`${file1}${file2}`);
          this.duplicates.modules.set(hash, {
            similarity,
            files: [file1, file2]
          });
        }
      }
    }
  }

  // ファイルを解析して関数の重複を検出
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

  // 関数のコードを取得
  getFunctionCode(node) {
    if (node.body.type === 'BlockStatement') {
      try {
        const code = node.body.body.map(stmt => {
          if (stmt.type === 'ExpressionStatement') {
            return stmt.expression.type;
          } else if (stmt.type === 'ReturnStatement' && stmt.argument) {
            return `return ${stmt.argument.type}`;
          } else {
            return stmt.type;
          }
        }).join('\n');

        // 行数が最小行数未満の場合はスキップ
        if (code.split('\n').length < this.options.minFunctionLines) {
          return '';
        }

        return code;
      } catch {
        // エラーの場合は空文字列を返す
        return '';
      }
    }
    return node.body.type || '';
  }

  // 関数の重複をチェック
  checkFunction(node, file, name = node.id?.name) {
    if (!name) return;

    const code = this.getFunctionCode(node);
    if (!code) return;

    const hash = this.generateHash(code);

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

  // 結果をフォーマット
  formatResults() {
    return {
      functions: Array.from(this.duplicates.functions.values()).map(dup => ({
        functionName: dup.name,
        occurrences: dup.locations.map(loc => ({
          file: path.relative(this.projectPath, loc.file),
          name: loc.name
        }))
      })),
      modules: Array.from(this.duplicates.modules.values()).map(dup => ({
        similarity: (dup.similarity * 100).toFixed(1) + '%',
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
  }
}

// メイン処理の実行
const projectPath = process.argv[2] || '.';
const checker = new DuplicateChecker(projectPath);

checker.analyzeDuplicates()
  .then(duplicates => {
    // 関数の重複
    console.log('\n重複している関数:');
    if (duplicates.functions.length === 0) {
      console.log('重複する関数は見つかりませんでした。');
    } else {
      duplicates.functions.forEach(dup => {
        console.log(`\n関数名: ${dup.functionName}`);
        console.log('検出場所:');
        dup.occurrences.forEach(loc => {
          console.log(`- ${loc.file} (名前: "${loc.name}")`);
        });
      });
    }

    // モジュールの重複
    console.log('\n類似したモジュール:');
    if (duplicates.modules.length === 0) {
      console.log('類似するモジュールは見つかりませんでした。');
    } else {
      duplicates.modules.forEach(dup => {
        console.log(`\n類似度: ${dup.similarity}`);
        console.log('ファイル:');
        dup.files.forEach(file => console.log(`- ${file}`));
      });
    }

    // リソースの重複
    console.log('\n重複しているリソース:');
    if (duplicates.resources.length === 0) {
      console.log('重複するリソースは見つかりませんでした。');
    } else {
      duplicates.resources.forEach(dup => {
        console.log(`\n値: ${dup.value}`);
        console.log('検出場所:');
        dup.occurrences.forEach(loc => {
          console.log(`- ${loc.file} (キー: "${loc.key}")`);
        });
      });
    }
  })
  .catch(err => {
    console.error('エラーが発生しました:', err);
    process.exit(1);
  });

export default DuplicateChecker;
