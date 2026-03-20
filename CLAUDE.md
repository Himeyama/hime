# Hime (HikariMessage) - VSCode AI Chat Extension

## プロジェクト概要

VSCode拡張機能。複数のAIプロバイダーとチャットできるサイドバーパネル型のパーソナルツール。

## 仕様

### 拡張機能名
- **Hime** (HikariMessage)

### AIプロバイダー
- Anthropic (Claude)
- OpenAI
- Azure OpenAI
- Ollama (ローカルLLM)
- OpenRouter

### プロバイダー切り替え
- メッセージ送信時にドロップダウンで都度選択可能
- 選択したプロバイダーは次回以降も継続される

### UI
- サイドバーパネル (Webview)
- リッチUI: Markdown応答表示、コードブロックのシンタックスハイライト、コピーボタン、画像表示、ファイル添付、リアクション

### チャット履歴
- ローカルファイルにJSON形式で永続保存 (`~/.hime/chats/`)
- チャット一覧メタデータは `~/.hime/chats-index.json`
- 設定は `~/.hime/settings.json`（APIキーは VSCode SecretStorage に暗号化保存）

### MCP
- 拡張機能がMCPクライアントとして動作
- 外部MCPサーバー（ファイル操作、DB操作など）に接続
- ワークスペースルートの `mcp.json` で設定
- ツール呼び出しループ対応（最大10反復）
- Windows環境では `npx` を自動的に `npx.cmd` に変換

### ストリーミング
- Ollama以外はストリーミング応答で対応
- MCPツール呼び出し中もストリーミングは継続（ツール実行結果をAIに返してループ）

### 会話コンテキスト管理
- ユーザーが手動でコンテキストをクリア（システムメッセージで区切り）
- 会話の圧縮（要約）オプションも用意

### コマンド
- `hime.newChat` — 新規チャット作成
- `hime.clearContext` — 会話コンテキストをクリア
- `hime.compressContext` — 会話を要約してコンテキストを圧縮
- `hime.sendSelection` — エディタの選択範囲をチャットに送信

### システムプロンプト
- グローバルに1つ設定
- 内容:
  - VSCodeで開いているディレクトリをフルパス（正規化済み）で作業ディレクトリとして設定
  - 言語は日本語
  - OSはシステムから自動取得
  - Windows → PowerShell コマンドを使用
  - Linux → bash コマンドを使用
  - コード編集の提案時は、まず該当コードをReadし、その後EditまたはWriteで変更する
  - アクティブなエディタタブのファイルを自動的にコンテキストに追加する
  - ワークスペースに CLAUDE.md / AGENTS.md / README.md が存在する場合、最初に読み込みシステムプロンプトに組み込む

### ターゲット
- 自分専用ツール（マーケットプレイス公開なし）

### 開発環境
- Windows 11
- シェル: PowerShell（開発時のコマンド実行に使用）

## 技術スタック

### Extension Host (Node.js)
- TypeScript (strict mode, ES2022)
- VSCode Extension API (Webview, SecretStorage, OutputChannel等)
- `@anthropic-ai/sdk` — Anthropic Claude API
- `openai` — OpenAI / Azure OpenAI / OpenRouter API
- `ollama` — Ollama ローカルLLM
- `@modelcontextprotocol/sdk` — MCPクライアント (StdioClientTransport)

### Webview (React)
- React 19
- Tailwind CSS + PostCSS (VSCodeテーマ変数を統合)
- Radix UI (Collapsible, Select, Tooltip)
- `react-markdown` + `remark-gfm` — Markdown描画
- `highlight.js` — シンタックスハイライト

### ビルド
- esbuild — バンドル (Extension: CJS形式, Webview: IIFE形式)
- TypeScript — 型チェック
- vitest — テスト

## アーキテクチャ

```
Extension Host (Node.js)
├── HimeChatViewProvider      # Webview管理・メッセージハンドラ
├── ChatHistoryStorage        # チャット履歴永続化
├── SettingsStorage           # 設定管理
├── MCPClientManager          # MCPサーバー接続管理
├── ActiveEditorTracker       # アクティブエディタ追跡
└── AIProvider (各実装)       # Anthropic / OpenAI / AzureOpenAI / Ollama / OpenRouter

Webview (Browser / React)
├── App                       # メインレイアウト
├── ChatView                  # チャットUI
└── Hooks
    ├── useVSCode             # VSCode Webview API ラッパー
    ├── useChat               # チャット状態管理
    └── useSettings           # 設定・APIキー管理
```

### 通信フロー
- **Webview → Extension**: `postMessage(WebviewToExtensionMessage)`
- **Extension → Webview**: `webview.postMessage(ExtensionToWebviewMessage)`
- **APIキー**: VSCode SecretStorage (暗号化)

### AIプロバイダー統一インターフェース
```typescript
interface AIProvider {
  chat(messages, systemPrompt, onToken, onToolCall?, signal?, tools?): Promise<Message>
  listModels(): Promise<string[]>
  testConnection(): Promise<boolean>
}
```
