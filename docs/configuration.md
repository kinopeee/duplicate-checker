# 設定リファレンス

## 基本設定
| オプション | 型 | デフォルト値 | 説明 |
|------------|------|------------|------|
| memoryLimit | number | 1GB | 最大メモリ使用量 |
| maxConcurrentProcesses | number | 4 | 並行処理の最大数 |
| debug | boolean | false | デバッグモード |
| language | string | "ja" | 使用言語（"ja"または"en"） |

## 重複判定設定
| オプション | 型 | デフォルト値 | 説明 |
|------------|------|------------|------|
| minFunctionLines | number | 3 | 関数の最小行数 |
| similarityThreshold | number | 0.8 | 類似度の閾値 |
| ignoreComments | boolean | true | コメントを無視 |
| excludePackageFiles | boolean | true | パッケージ設定ファイルを除外 |

## リソース比較設定
| オプション | 型 | デフォルト値 | 説明 |
|------------|------|------------|------|
| resourceComparison.stringThreshold | number | 0.8 | 文字列の類似度閾値 |
| resourceComparison.numberThreshold | number | 0.1 | 数値の類似度閾値 |
| resourceComparison.arrayThreshold | number | 0.7 | 配列の類似度閾値 |
| resourceComparison.maxDepth | number | 5 | オブジェクトの最大探索深度 |
| resourceComparison.enableStringComparison | boolean | true | 文字列比較を有効化 |
| resourceComparison.enableNumberComparison | boolean | true | 数値比較を有効化 |
| resourceComparison.enableArrayOrderCheck | boolean | true | 配列順序チェックを有効化 |
| resourceComparison.structureWeight | number | 0.4 | 構造の重み付け |
| resourceComparison.valueWeight | number | 0.6 | 値の重み付け |

## 除外設定
| オプション | 型 | デフォルト値 | 説明 |
|------------|------|------------|------|
| excludePatterns | string[] | ["*.config.js", "*.config.ts"] | 除外するファイルパターン |
| ignoredResourceKeys | string[] | ["description", "altText"] | 無視するリソースキー |
| targetExtensions | string[] | [".js", ".ts", ".yaml"] | 対象とするファイル拡張子 |

## 設定例

### 基本設定
```json
{
  "memoryLimit": 1073741824,
  "maxConcurrentProcesses": 4,
  "debug": false,
  "language": "ja"
}
```

### 重複判定設定
```json
{
  "minFunctionLines": 3,
  "similarityThreshold": 0.8,
  "ignoreComments": true,
  "excludePackageFiles": true
}
```

### リソース比較設定
```json
{
  "resourceComparison": {
    "stringThreshold": 0.8,
    "numberThreshold": 0.1,
    "arrayThreshold": 0.7,
    "maxDepth": 5,
    "enableStringComparison": true,
    "enableNumberComparison": true,
    "enableArrayOrderCheck": true,
    "structureWeight": 0.4,
    "valueWeight": 0.6
  }
}
```

### 除外設定
```json
{
  "excludePatterns": [
    "*.config.js",
    "*.config.ts",
    "tsconfig.json",
    "package.json"
  ],
  "ignoredResourceKeys": [
    "description",
    "altText"
  ],
  "targetExtensions": [
    ".js",
    ".ts",
    ".yaml"
  ]
}
```

## 注意事項
- メモリ制限は必ずバイト単位で指定してください
- 類似度の閾値は0.0から1.0の範囲で指定してください
- 重み付けの合計は1.0になるように設定してください
- 除外パターンはglobパターンをサポートしています
