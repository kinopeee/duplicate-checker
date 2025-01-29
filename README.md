# コード重複チェッカー

このツールは、プロジェクト内のコードやリソースの重複を検出するための静的解析ツールです。

## 機能

- 関数の重複検出
- モジュール間の類似度チェック
- リソースファイル（JSON/YAML）内の重複値の検出

## インストール

```bash
npm install
```

必要な依存パッケージ：
- @babel/parser
- @babel/traverse
- js-yaml

## プロジェクト構成

```
.
├── duplicate-checker.js      # メインスクリプト
├── duplicate-checker.config.json  # 重複チェッカーの設定
└── tsconfig.json            # TypeScript設定
```

## 使用方法

```bash
node duplicate-checker.js [プロジェクトパス]
```

プロジェクトパスを指定しない場合は、カレントディレクトリがチェック対象となります。

## 設定ファイル

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
    ".json",
    ".yaml"
  ]
}
```

- `moduleSimilarityThreshold`: モジュールの類似度閾値（0.0〜1.0）
- `ignoredResourceKeys`: リソースチェック時に無視するキー
- `targetExtensions`: チェック対象のファイル拡張子

### tsconfig.json

TypeScriptプロジェクトとの互換性を確保するための設定ファイルです：

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

主な設定項目：
- `module`と`moduleResolution`: `NodeNext`に設定し、最新のNode.js互換性を確保
- `target`: ES2017を対象にコンパイル
- `lib`: 利用可能なAPI定義を指定
- `jsx`: "preserve"でJSXの変換を保持
- `paths`: モジュールのエイリアスを設定（`@/*`で任意のパスを参照可能）
- `include`: TypeScriptのチェック対象ファイル
- `exclude`: チェックから除外するファイル

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
- JSON/YAMLファイル内の重複値を検出
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

## 設定オプション

デフォルトの設定：
- `excludePackageFiles`: true（package.jsonを除外）
- `similarityThreshold`: 0.7（モジュール類似度の閾値）
- `minFunctionLines`: 3（関数の最小行数）

## 除外設定

以下のディレクトリは自動的に除外されます：
- node_modules
- .next
- build
- dist
- .git

## 注意事項

- TypeScript/JSXファイルにも対応しています
- 大規模なプロジェクトの場合、解析に時間がかかる場合があります
- パースエラーが発生した場合は、該当ファイルをスキップして処理を継続します
- Next.jsプロジェクトと互換性があり、TypeScriptの設定に従って動作します
