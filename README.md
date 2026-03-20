# Hime (HikariMessage)

VSCode上で複数のAIプロバイダーとチャットできるサイドバーパネル型の拡張機能。

![Hime](docs/image.png)

## 機能

- **マルチプロバイダー対応** — Anthropic (Claude)・OpenAI・Azure OpenAI・Ollama・OpenRouter をドロップダウンで切り替え
- **ストリーミング応答** — トークン単位でリアルタイム表示
- **MCP連携** — 外部MCPサーバーに接続し、ファイル操作・DB操作などのツールをAIから実行（ツール呼び出しループ対応）
- **リッチUI** — Markdown描画、コードブロックのシンタックスハイライト、コピーボタン、画像表示、ファイル添付、リアクション
- **チャット履歴** — `~/.hime/chats/` にJSON形式で永続保存
- **コンテキスト管理** — 手動クリア・会話圧縮（要約）
- **システムプロンプト自動構築** — ワークスペース情報、OS、アクティブエディタ、CLAUDE.md等を自動反映
- **セキュアなAPIキー管理** — VSCode SecretStorage に暗号化保存

## 必要環境

- Node.js 20+
- VSCode 1.96+

## セットアップ

```powershell
git clone <repository-url>
cd hime
npm install
```

## ビルド

```powershell
# 型チェックのみ
npm run check-types

# フルビルド（型チェック + バンドル）
npm run compile

# プロダクションビルド（minify付き）
npm run package

# VSIXパッケージ作成
npx @vscode/vsce package
```

## 開発

```powershell
# Extension Host + Webview の両方をウォッチモードで起動
npm run watch
```

または VSCode 上で **F5** キーを押すと、拡張機能開発ホストが起動します。

Webview の DevTools は `Ctrl+Shift+P` → `Developer: Open Webview Developer Tools` で開けます。

## コマンド

| コマンド | 説明 |
|---|---|
| `Hime: New Chat` | 新規チャットを作成 |
| `Hime: Clear Context` | 会話コンテキストをクリア |
| `Hime: Compress Context` | 会話を要約してコンテキストを圧縮 |
| `Hime: Send Selection` | エディタの選択範囲をチャットに送信 |

## プロバイダー設定

サイドバーの **⚙** ボタンから設定パネルを開き、各プロバイダーの API キー・エンドポイント・モデルを設定できます。

| プロバイダー | API キー | デフォルトエンドポイント |
|---|---|---|
| Anthropic | 必要 | `https://api.anthropic.com` |
| OpenAI | 必要 | `https://api.openai.com` |
| Azure OpenAI | 必要 | ユーザー指定 |
| Ollama | 不要 | `http://localhost:11434` |
| OpenRouter | 必要 | `https://openrouter.ai/api` |

API キーは VSCode の SecretStorage に暗号化保存されます。

## MCP サーバー設定

ワークスペースルートに `mcp.json` を配置すると、拡張機能起動時に自動接続します。

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    }
  }
}
```

Windows 環境では `npx` は自動的に `npx.cmd` に変換されます。

## ディレクトリ構成

```
hime/
├── src/
│   ├── extension.ts          # エントリーポイント (HimeChatViewProvider)
│   ├── types/
│   │   ├── chat.ts           # チャット・メッセージ型定義
│   │   ├── mcp.ts            # MCP型定義
│   │   ├── messages.ts       # Webview↔Extension通信型定義
│   │   └── provider.ts       # AIプロバイダー型定義
│   ├── providers/
│   │   ├── base.ts           # プロバイダー基底クラス
│   │   ├── index.ts          # プロバイダーファクトリ
│   │   ├── anthropic.ts      # Anthropic (Claude) 実装
│   │   ├── openai.ts         # OpenAI 実装
│   │   ├── azure-openai.ts   # Azure OpenAI 実装
│   │   ├── ollama.ts         # Ollama (ローカルLLM) 実装
│   │   └── openrouter.ts     # OpenRouter 実装
│   ├── mcp/
│   │   ├── client.ts         # MCPクライアント管理
│   │   └── tool-executor.ts  # MCPツール定義変換
│   ├── storage/
│   │   ├── chat-history.ts   # チャット履歴永続保存
│   │   └── settings.ts       # 設定管理
│   ├── context/
│   │   ├── system-prompt.ts  # システムプロンプト構築
│   │   ├── active-editor.ts  # アクティブエディタ追跡
│   │   └── workspace-files.ts # ワークスペースファイル読み込み
│   └── webview/              # React UI
│       ├── App.tsx           # メインコンポーネント
│       ├── components/       # UIコンポーネント
│       ├── hooks/            # React Hooks (useChat, useSettings, useVSCode)
│       └── styles/           # Tailwind CSS
├── dist/                     # ビルド出力
│   ├── extension.js          # Extension バンドル
│   ├── webview.js            # Webview バンドル
│   └── webview.css           # スタイルシート
├── docs/                     # ドキュメント・スクリーンショット
├── resources/                # アイコン
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── esbuild.js                # ビルドスクリプト
```

## データ保存先

```
~/.hime/
├── settings.json             # プロバイダー設定（APIキー以外）
├── chats-index.json          # チャット一覧メタデータ
└── chats/
    └── {chat-id}.json        # 各チャットの会話履歴
```
