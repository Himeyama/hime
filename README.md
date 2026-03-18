# Hime (HikariMessage)

VSCode上で複数のAIプロバイダーとチャットできるサイドバーパネル型の拡張機能。

![Hime](docs/image.png)

## 機能

- **マルチプロバイダー対応** — Anthropic (Claude)・OpenAI・Azure OpenAI・Ollama をドロップダウンで切り替え
- **ストリーミング応答** — トークン単位でリアルタイム表示
- **MCP連携** — 外部MCPサーバーに接続し、ファイル操作・DB操作などのツールをAIから実行
- **リッチUI** — Markdown描画、コードブロックのシンタックスハイライト、コピーボタン、画像表示、ファイル添付、リアクション
- **チャット履歴** — `~/.hime/chats/` にJSON形式で永続保存
- **コンテキスト管理** — 手動クリア・会話圧縮（要約）
- **システムプロンプト自動構築** — ワークスペース情報、OS、アクティブエディタ、CLAUDE.md等を自動反映

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
# フルビルド（型チェック + バンドル）
npm run compile

# プロダクションビルド（minify付き）
npm run package
```

## 開発

```powershell
# Extension Host + Webview の両方をウォッチモードで起動
npm run watch
```

または VSCode 上で **F5** キーを押すと、拡張機能開発ホストが起動します。

Webview の DevTools は `Ctrl+Shift+P` → `Developer: Open Webview Developer Tools` で開けます。

## プロバイダー設定

サイドバーの **⚙** ボタンから設定パネルを開き、各プロバイダーの API キー・エンドポイント・モデルを設定できます。

| プロバイダー | API キー | デフォルトエンドポイント |
|---|---|---|
| Anthropic | 必要 | `https://api.anthropic.com` |
| OpenAI | 必要 | `https://api.openai.com` |
| Azure OpenAI | 必要 | ユーザー指定 |
| Ollama | 不要 | `http://localhost:11434` |

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

## ディレクトリ構成

```
hime/
├── src/
│   ├── extension.ts          # エントリーポイント
│   ├── types/                # 型定義
│   ├── providers/            # AIプロバイダー実装
│   ├── mcp/                  # MCPクライアント
│   ├── storage/              # チャット履歴・設定管理
│   ├── context/              # システムプロンプト・エディタコンテキスト
│   └── webview/              # React UI
│       ├── components/       # UIコンポーネント
│       ├── hooks/            # React Hooks
│       └── styles/           # CSS
├── dist/                     # ビルド出力
├── package.json
├── tsconfig.json
└── esbuild.js               # ビルドスクリプト
```

## データ保存先

```
~/.hime/
├── settings.json             # プロバイダー設定（APIキー以外）
├── chats-index.json          # チャット一覧メタデータ
└── chats/
    └── {chat-id}.json        # 各チャットの会話履歴
```
