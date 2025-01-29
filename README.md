# コード重複チェッカー

このツールは、プロジェクト内のコードやリソースの重複を検出するための静的解析ツールです。

## 機能

- 関数の重複検出（同一実装、最小3行以上）
- モジュール間の類似度チェック（Jaccard類似度アルゴリズム使用）
- リソースファイル（JSON/YAML）内の重複値の検出

## インストール

```bash
npm install @babel/parser @babel/traverse js-yaml
```

## 基本的な使用方法

```bash
node duplicate-checker.js [プロジェクトパス]
```

プロジェクトパスを指定しない場合は、カレントディレクトリがチェック対象となります。

## プロジェクト構成

```
.
├── duplicate-checker.js      # メインスクリプト
├── duplicate-checker.config.json  # 重複チェッカーの設定
└── tsconfig.json            # TypeScript設定（オプション）
```

## 設定

### duplicate-checker.config.json

```json
{
  "moduleSimilarityThreshold": 0.7,
  "ignoredResourceKeys": ["description", "altText"],
  "targetExtensions": [".js", ".ts", ".jsx", ".tsx", ".json", ".yaml"],
  "excludePackageFiles": true,
  "minFunctionLines": 3
}
```

#### パラメーター説明

- `moduleSimilarityThreshold`: モジュール間の類似度閾値（0.0〜1.0）
  - 0.7は70%の類似度を意味する
  - 値が大きいほど、より厳密な重複判定となる
  - 推奨値は0.7〜0.8の範囲
- `ignoredResourceKeys`: リソースファイル内で重複チェックを無視するキー
- `targetExtensions`: 解析対象とするファイルの拡張子
- `excludePackageFiles`: package.jsonを除外するかどうか（デフォルト: true）
- `minFunctionLines`: 重複チェック対象となる関数の最小行数

### 自動除外ディレクトリ
- node_modules
- .next
- build
- dist
- .git

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

## Next.jsプロジェクトへの導入

### 1. package.jsonへのスクリプト追加

```json
{
  "scripts": {
    "check-duplicates": "node duplicate-checker.js"
  }
}
```

### 2. 実行

```bash
# プロジェクト全体のチェック
npm run check-duplicates

# 特定ディレクトリのチェック
npm run check-duplicates -- src/components
```

### Next.js固有の注意事項
- `pages`ディレクトリ内のルーティングコンポーネントは重複として検出される可能性あり
- `getStaticProps`や`getServerSideProps`などのNext.js固有の関数は無視
- `.next`ディレクトリは自動的に除外

## 一般的な注意事項

- TypeScript/JSXファイルに完全対応
- 大規模プロジェクトでは解析に時間がかかる場合あり
- パースエラー発生時は該当ファイルをスキップして継続
- TypeScriptの設定に従って動作（tsconfig.jsonが存在する場合）

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルをご覧ください。
