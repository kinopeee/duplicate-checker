# コード重複チェッカー

このツールは、プロジェクト内のコードやリソースの重複を検出するための静的解析ツールです。

## 機能

- 関数の重複検出（正規化された実装の比較）
- モジュール間の類似度チェック（Jaccard類似度による分析）
- リソースファイル（JSON/YAML）内の重複値の検出
- 大規模プロジェクト向けのメモリ最適化
- 設定可能な類似度閾値
- 多言語対応（日本語/英語）
- 並行処理による高速な解析
- 詳細な進捗レポート

## インストール

```bash
npm install
```

必要な依存パッケージ：
- @babel/parser: コード解析
- @babel/traverse: AST走査
- js-yaml: YAMLファイル処理
- i18n: 多言語対応

## 設定オプション
| オプション | 型 | デフォルト値 | 説明 |
|------------|------|------------|------|
| memoryLimit | number | 1GB | 最大メモリ使用量 |
| maxConcurrentProcesses | number | 4 | 並行処理の最大数 |
| debug | boolean | false | デバッグモード |
| minFunctionLines | number | 3 | 関数の最小行数 |
| resourceComparison.stringThreshold | number | 0.8 | 文字列の類似度閾値 |
| resourceComparison.numberThreshold | number | 0.1 | 数値の類似度閾値 |
| resourceComparison.arrayThreshold | number | 0.7 | 配列の類似度閾値 |
| resourceComparison.maxDepth | number | 5 | オブジェクトの最大探索深度 |

## プロジェクト構成

```
.
├── duplicate-checker.js      # メインスクリプト
├── duplicate-checker.config.json  # 重複チェッカーの設定
├── tsconfig.json            # TypeScript設定
└── locales/                 # 言語ファイル
    ├── en.json             # 英語翻訳
    └── ja.json             # 日本語翻訳
```

## 使用方法

```bash
node duplicate-checker.js [プロジェクトパス]
```

プロジェクトパスを指定しない場合は、カレントディレクトリがチェック対象となります。

## 言語設定

このツールは日本語と英語の両方をサポートしています。言語の選択は以下の優先順位で行われます：

1. 環境変数: `DUPLICATE_CHECKER_LANG`
   ```bash
   DUPLICATE_CHECKER_LANG=en node duplicate-checker.js
   ```

2. 設定ファイル（`duplicate-checker.config.json`）:
   ```json
   {
     "language": "en"
   }
   ```

3. デフォルト: 日本語（後方互換性のため）


## 重複チェックの設定

### duplicate-checker.config.json

重複チェッカーの動作をカスタマイズするための設定ファイルです：

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
  "language": "ja",
  "excludePatterns": [
    "tsconfig.json",
    "package.json",
    "*.config.json",
    "*.config.js",
    "*.config.ts"
  ]
}
```

- `moduleSimilarityThreshold`: モジュールの類似度閾値（0.0〜1.0）
- `ignoredResourceKeys`: リソースチェック時に無視するキー
- `targetExtensions`: チェック対象のファイル拡張子
- `excludePatterns`: 重複チェックから除外するファイル（glob パターンをサポート）

> 注意: 設定ファイル（tsconfig.json, package.json, *.config.jsonなど）は重複チェックの対象から除外されます。これらのファイルは、プロジェクトの構成を定義するものであり、同じような設定が異なる目的で必要となる場合があるためです。

## 検出対象

### 1. 関数の重複
- 同じ実装を持つ関数を検出
- 最小行数（デフォルト：3行）以上の関数が対象
- 関数名や場所に関係なく、実装の一致を検出

### 2. モジュールの類似度
- ファイル間の類似度を計算
- デフォルトの類似度閾値：70%以上
- Jaccard類似度アルゴリズムを使用

### 3. リソースの重複
- YAMLファイル内の重複値を検出
- ネストされたオブジェクトにも対応
- キーパスとともに重複箇所を報告

## 出力フォーマット

```
重複している関数:
関数名: [関数名]
検出場所:
- [ファイルパス] (名前: "[関数名]")

類似したモジュール:
類似度: [類似度]%
ファイル:
- [ファイルパス1]
- [ファイルパス2]

重複しているリソース:
値: [重複値]
検出場所:
- [ファイルパス] (キー: "[キーパス]")
```

## 除外設定

以下のディレクトリは自動的に除外されます：
- node_modules
- .next
- build
- dist
- .git

## メモリ使用量の推奨設定
プロジェクトの規模に応じて、以下のメモリ制限を推奨します：

- 1000ファイル未満: 1GB
- 1000-5000ファイル: 2GB
- 5000ファイル以上: 4GB

## エラー処理
`DuplicateCheckerError` クラスによるエラー処理：

| エラーコード | 説明 | 対処方法 |
|-------------|------|----------|
| E001 | ファイルが見つかりません | 指定したパスが正しいか確認してください |
| E002 | パースエラー | ファイルの構文が正しいか確認してください |
| E003 | メモリ制限超過 | memoryLimitの値を増やすか、分析を分割してください |
| E004 | 設定が無効です | 設定オプションの値を確認してください |

## トラブルシューティング

### メモリ制限超過
- memoryLimitオプションを増やす
- maxConcurrentProcessesを減らす
- 分析を小さな単位に分割する

### パースエラー
- ファイルのエンコーディングを確認
- ソースファイルの構文を確認
- デバッグモードを有効にして詳細なログを確認

### パフォーマンスの最適化
- maxConcurrentProcessesを調整して並行処理を最適化
- リソース比較の閾値を調整
- 不要なファイルを除外パターンに追加

## プロジェクト設定（参考）

このツールはTypeScriptプロジェクトで使用することを想定しています。以下は参考として、推奨されるTypeScript設定です。

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

## 注意事項

- TypeScript/JSXファイルにも対応しています
- 大規模なプロジェクトの場合、解析に時間がかかる場合があります
- パースエラーが発生した場合は、該当ファイルをスキップして処理を継続します
- Next.jsプロジェクトと互換性があり、TypeScriptの設定に従って動作します
- メモリ使用量を監視し、必要に応じて設定を調整してください
- 大規模プロジェクトでは並行処理数を適切に設定することで処理時間を短縮できます
