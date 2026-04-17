# Hime (HikariMessage) 詳細設計書

## 1. 概要

### 1.1 プロダクト名
**Hime** (HikariMessage)

### 1.2 目的
VSCode上で複数のAIプロバイダーとチャットできるサイドバーパネル型の拡張機能。
MCPクライアントとして外部ツールと連携し、コード編集を含む高度なタスクを実行する。

### 1.3 ターゲット
自分専用ツール（マーケットプレイス公開なし）

---

## 2. アーキテクチャ

### 2.1 全体構成

```
┌─────────────────────────────────────────────────────┐
│ VSCode                                              │
│                                                     │
│  ┌──────────────┐    postMessage     ┌───────────┐  │
│  │  Webview UI  │◄─────────────────►│ Extension  │  │
│  │  (React)     │                    │   Host     │  │
│  │              │                    │ (Node.js)  │  │
│  └──────────────┘                    └─────┬──────┘  │
│                                            │         │
└────────────────────────────────────────────┼─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐          ┌──────▼──────┐         ┌──────▼──────┐
              │ AI Provider│          │ MCP Server  │         │ Local JSON  │
              │  APIs      │          │ (外部)       │         │ Storage     │
              └───────────┘          └─────────────┘         └─────────────┘
```

### 2.2 レイヤー構成

| レイヤー | 責務 | 実行環境 |
|---------|------|---------|
| Webview UI | チャットUI、ユーザー操作 | ブラウザ (iframe) |
| Extension Host | API呼び出し、MCP、ファイルI/O、状態管理 | Node.js |
| Provider Layer | 各AIプロバイダーへの接続抽象化 | Node.js |
| MCP Client | MCPサーバーへの接続・ツール実行 | Node.js |
| Storage | チャット履歴の永続化 | ファイルシステム |

---

## 3. 技術スタック

### 3.1 Extension Host (バックエンド)
- **言語**: TypeScript
- **ランタイム**: Node.js (VSCode内蔵)
- **バンドラー**: esbuild（高速ビルド）

### 3.2 Webview UI (フロントエンド)
- **フレームワーク**: React 19 + TypeScript
- **スタイリング**: Tailwind CSS 3（VSCode CSS変数をカスタムカラーとして統合）
- **Markdown描画**: react-markdown + remark-gfm
- **シンタックスハイライト**: shiki（VSCodeと同じTextMate文法）
- **バンドラー**: esbuild（PostCSS + Tailwind CSSプラグイン付き、Extension Hostと別設定でビルド）

### 3.3 AI SDK
| プロバイダー | パッケージ |
|-------------|-----------|
| Anthropic | `@anthropic-ai/sdk` |
| OpenAI | `openai` |
| Azure OpenAI | `openai`（Azure設定で利用） |
| Ollama | `ollama` |

### 3.4 MCP
- `@modelcontextprotocol/sdk` — MCPクライアント実装

### 3.5 主要依存パッケージ一覧

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "openai": "latest",
    "ollama": "latest",
    "@modelcontextprotocol/sdk": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "latest",
    "remark-gfm": "latest",
    "shiki": "latest"
  },
  "devDependencies": {
    "@types/vscode": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vscode/webview-ui-toolkit": "latest",
    "autoprefixer": "latest",
    "postcss": "latest",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "esbuild": "latest",
    "npm-run-all": "latest"
  }
}
```

---

## 4. ディレクトリ構成

```
hime/
├── .vscode/
│   ├── launch.json              # デバッグ設定
│   └── tasks.json               # ビルドタスク
├── docs/
│   └── design.md                # 本設計書
├── tailwind.config.js           # Tailwind CSS設定（VSCodeカラー統合）
├── src/
│   ├── extension.ts             # エントリーポイント（activate/deactivate）
│   ├── types/
│   │   ├── chat.ts              # チャット関連の型定義
│   │   ├── provider.ts          # プロバイダー関連の型定義
│   │   ├── mcp.ts               # MCP関連の型定義
│   │   └── messages.ts          # Webview⇔Host間メッセージ型
│   ├── providers/
│   │   ├── base.ts              # AIプロバイダー基底クラス
│   │   ├── anthropic.ts         # Anthropic (Claude)
│   │   ├── openai.ts            # OpenAI
│   │   ├── azure-openai.ts      # Azure OpenAI
│   │   ├── ollama.ts            # Ollama
│   │   └── index.ts             # プロバイダーファクトリ
│   ├── mcp/
│   │   ├── client.ts            # MCPクライアント管理
│   │   └── tool-executor.ts     # MCPツール実行ハンドラ
│   ├── storage/
│   │   ├── chat-history.ts      # チャット履歴の読み書き
│   │   └── settings.ts          # ユーザー設定管理
│   ├── context/
│   │   ├── active-editor.ts     # アクティブエディタのコンテキスト取得
│   │   ├── workspace-files.ts   # CLAUDE.md等のワークスペースファイル読込
│   │   └── system-prompt.ts     # システムプロンプト生成
│   └── webview/
│       ├── index.tsx             # Reactエントリーポイント
│       ├── App.tsx               # ルートコンポーネント
│       ├── hooks/
│       │   ├── useVSCode.ts     # VSCode API (postMessage) フック
│       │   ├── useChat.ts       # チャット状態管理
│       │   └── useStreaming.ts  # ストリーミング受信管理
│       ├── components/
│       │   ├── ChatView.tsx     # チャット画面全体
│       │   ├── MessageList.tsx  # メッセージ一覧
│       │   ├── MessageBubble.tsx # 個別メッセージ
│       │   ├── CodeBlock.tsx    # コードブロック（シンタックスハイライト）
│       │   ├── InputArea.tsx    # メッセージ入力エリア
│       │   ├── ProviderSelect.tsx # プロバイダー選択ドロップダウン
│       │   ├── FileAttachment.tsx # ファイル添付UI
│       │   ├── ImagePreview.tsx  # 画像表示
│       │   ├── Reactions.tsx     # リアクション
│       │   ├── ChatList.tsx     # チャット一覧（サイドバー）
│       │   └── ToolCallView.tsx # MCPツール呼び出し表示
│       └── styles/
│           └── index.css        # スタイル定義
├── test/
│   └── suite/
│       ├── providers.test.ts
│       ├── storage.test.ts
│       └── mcp.test.ts
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── esbuild.js                   # ビルドスクリプト
└── .vscodeignore
```

---

## 5. 画面設計

### 5.1 サイドバーレイアウト

```
┌─────────────────────────────┐
│ 🏠 Hime          [⚙] [+] │  ← ヘッダー (設定・新規チャットボタン)
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📄 チャット1            │ │  ← チャット一覧（折りたたみ可能）
│ │ 📄 チャット2            │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│                             │
│  🤖 こんにちは！何をお手伝い │  ← メッセージ表示エリア
│  しましょうか？              │    (Markdown + コードブロック)
│                             │
│  👤 このコードを説明して     │
│                             │
│  🤖 このコードは...         │
│  ```typescript              │
│  function foo() {  [📋]    │  ← コピーボタン付きコードブロック
│    return "bar";            │
│  }                          │
│  ```                        │
│                             │
│  👍 👎                      │  ← リアクション
│                             │
├─────────────────────────────┤
│ [📎] [🖼️]                   │  ← 添付・画像ボタン
│ ┌─────────────────────────┐ │
│ │ メッセージを入力...      │ │  ← 入力エリア
│ └─────────────────────────┘ │
│ [Claude ▼]          [送信] │  ← プロバイダー選択 + 送信ボタン
└─────────────────────────────┘
```

### 5.2 設定画面

ヘッダーの [⚙] ボタンで開閉するインライン設定パネル。プロバイダーごとの API キー・エンドポイント・モデルを UI 上で直接変更できる:

```
┌─────────────────────────────┐
│ ⚙ 設定                  [✕] │
├─────────────────────────────┤
│                             │
│ ▼ Anthropic                 │
│   API Key:  [sk-ant-•••••] │  ← パスワードマスク表示、目アイコンで表示切替
│   Endpoint: [https://api..] │  ← カスタムエンドポイント（空欄でデフォルト）
│   Model:    [claude-sonn ▼] │  ← ドロップダウン or 自由入力
│                             │
│ ▶ OpenAI                    │  ← 折りたたみ状態
│ ▶ Azure OpenAI              │
│ ▶ Ollama                    │
│                             │
│ ▼ 共通設定                   │
│   System Prompt:            │
│   ┌───────────────────────┐ │
│   │ あなたはAIアシスタン... │ │  ← テキストエリア
│   └───────────────────────┘ │
│                             │
└─────────────────────────────┘
```

- 各プロバイダーはアコーディオンで折りたたみ可能
- API キーはマスク表示（`•••••`）、目アイコンで表示/非表示を切り替え
- Endpoint は空欄の場合、各プロバイダーのデフォルト URL を使用
- 変更は即座にローカルの `~/.hime/settings.json` に保存
- API キーは VSCode SecretStorage に暗号化保存

### 5.3 ツール呼び出し表示

MCPツールが実行された場合、チャット内にインライン表示する:

```
┌─ 🔧 ツール実行: read_file ──────┐
│ パス: /src/index.ts              │
│ ステータス: ✅ 完了               │
│ [▶ 結果を表示]                    │  ← 折りたたみ可能
└──────────────────────────────────┘
```

---

## 6. データモデル

### 6.1 チャット (Chat)

```typescript
interface Chat {
  id: string;                    // UUID
  title: string;                 // チャットタイトル（自動生成 or 手動設定）
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  messages: Message[];
  provider: ProviderType;        // 最後に使用したプロバイダー
  systemPrompt?: string;         // チャット固有のオーバーライド（将来拡張）
}
```

### 6.2 メッセージ (Message)

```typescript
interface Message {
  id: string;                    // UUID
  role: "user" | "assistant" | "system";
  content: string;               // Markdownテキスト
  provider?: ProviderType;       // 応答生成に使用したプロバイダー
  model?: string;                // 使用したモデル名
  timestamp: string;             // ISO 8601
  attachments?: Attachment[];    // 添付ファイル
  toolCalls?: ToolCall[];        // MCPツール呼び出し
  reactions?: Reaction[];        // リアクション
}
```

### 6.3 添付ファイル (Attachment)

```typescript
interface Attachment {
  type: "file" | "image";
  name: string;
  path: string;                  // ローカルファイルパス
  mimeType: string;
  content?: string;              // テキストファイルの場合は内容
  base64?: string;               // 画像の場合はBase64
}
```

### 6.4 ツール呼び出し (ToolCall)

```typescript
interface ToolCall {
  id: string;
  name: string;                  // MCPツール名
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
  result?: string;
  error?: string;
}
```

### 6.5 プロバイダー設定 (ProviderConfig)

```typescript
type ProviderType = "anthropic" | "openai" | "azure-openai" | "ollama";

interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;               // API キー（VSCode SecretStorage に暗号化保存）
  endpoint?: string;             // カスタムエンドポイントURL（空欄でデフォルト）
  deploymentName?: string;       // Azure OpenAI のデプロイメント名
  model: string;                 // モデル名
}

// 各プロバイダーのデフォルトエンドポイント
// Anthropic:    https://api.anthropic.com
// OpenAI:       https://api.openai.com
// Azure OpenAI: ユーザー指定必須
// Ollama:       http://localhost:11434
```

### 6.6 リアクション (Reaction)

```typescript
interface Reaction {
  type: "thumbsUp" | "thumbsDown";
  messageId: string;
}
```

---

## 7. ストレージ設計

### 7.1 保存先

```
~/.hime/
├── settings.json               # グローバル設定
├── chats/
│   ├── {chat-id-1}.json        # 各チャットを個別JSONファイルで保存
│   ├── {chat-id-2}.json
│   └── ...
└── chats-index.json            # チャット一覧（メタデータのみ）
```

### 7.2 settings.json

プロバイダー設定（エンドポイント・モデル等）を保存。API キーは含めず、VSCode SecretStorage に暗号化保存する:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "endpoint": "",
      "model": "claude-sonnet-4-20250514"
    },
    "openai": {
      "endpoint": "",
      "model": "gpt-4o"
    },
    "azure-openai": {
      "endpoint": "",
      "deploymentName": "",
      "model": "gpt-4o"
    },
    "ollama": {
      "endpoint": "http://localhost:11434",
      "model": "llama3.1"
    }
  },
  "systemPrompt": ""
}
```

### 7.3 chats-index.json

全チャットのメタデータを保持（一覧表示の高速化）:

```json
{
  "chats": [
    {
      "id": "uuid-1",
      "title": "TypeScriptの質問",
      "createdAt": "2026-03-18T10:00:00Z",
      "updatedAt": "2026-03-18T10:30:00Z",
      "provider": "anthropic",
      "messageCount": 12
    }
  ]
}
```

### 7.3 個別チャットファイル

`chats/{id}.json` に `Chat` オブジェクト全体を保存。

---

## 8. プロバイダー設計

### 8.1 基底インターフェース

```typescript
interface AIProvider {
  readonly type: ProviderType;
  readonly displayName: string;

  // ストリーミングチャット
  chat(
    messages: Message[],
    systemPrompt: string,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void,
    signal?: AbortSignal
  ): Promise<Message>;

  // モデル一覧取得
  listModels(): Promise<string[]>;

  // 接続テスト
  testConnection(): Promise<boolean>;
}
```

### 8.2 プロバイダー別実装

| プロバイダー | SDK | ストリーミング方式 |
|-------------|-----|-------------------|
| Anthropic | `@anthropic-ai/sdk` | `messages.stream()` |
| OpenAI | `openai` | `chat.completions.create({ stream: true })` |
| Azure OpenAI | `openai` (Azure設定) | 同上 |
| Ollama | `ollama` | `chat({ stream: true })` |

### 8.3 プロバイダー切り替えフロー

1. UIのドロップダウンでプロバイダーを選択
2. 選択状態を `settings.json` に保存（次回起動時に復元）
3. メッセージ送信時、選択中のプロバイダーで応答を生成
4. 応答メッセージに使用プロバイダー・モデルを記録

---

## 9. MCP クライアント設計

### 9.1 接続管理

```typescript
interface MCPClientManager {
  // MCP サーバーへの接続
  connect(serverConfig: MCPServerConfig): Promise<void>;

  // 接続中のサーバー一覧
  listConnections(): MCPConnection[];

  // 利用可能なツール一覧
  listTools(): Promise<MCPTool[]>;

  // ツール実行
  executeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;

  // 切断
  disconnect(serverId: string): Promise<void>;
}
```

### 9.2 MCPサーバー設定

拡張機能専用の設定ファイル (`mcp.json`) で定義。ワークスペースルートに配置する:

```json
// mcp.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    },
    "custom-server": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {}
    }
  }
}
```

- サーバー名はオブジェクトのキーとして指定
- `command`: 起動コマンド
- `args`: コマンド引数（任意）
- `env`: 環境変数（任意）
- 拡張機能起動時に `mcp.json` を読み込み、定義されたサーバーに自動接続

### 9.3 MCP統合フロー

```
ユーザーメッセージ
       │
       ▼
  AIプロバイダーに送信（利用可能ツール一覧を含む）
       │
       ▼
  AIがtool_useを返す ──── テキスト応答の場合 → 直接表示
       │
       ▼
  MCPクライアントがツール実行
       │
       ▼
  ツール結果をAIに返送
       │
       ▼
  AIが最終応答を生成
       │
       ▼
  Webviewに表示
```

---

## 10. システムプロンプト設計

### 10.1 生成フロー

```
起動時 / チャット開始時
       │
       ▼
  ① CLAUDE.md / AGENTS.md / README.md を検索・読み込み
       │
       ▼
  ② OS情報を取得（process.platform）
       │
       ▼
  ③ ワークスペースのフルパスを取得
       │
       ▼
  ④ アクティブエディタのファイル情報を取得
       │
       ▼
  ⑤ テンプレートに合成
```

### 10.2 システムプロンプトテンプレート

```
あなたはコーディングアシスタントです。

# 作業ディレクトリ
{workspacePath}（フルパス、正規化済み）

# OS
{osName}

# シェル
{shell}（Windows: PowerShell / Linux: bash）

# 言語
日本語で応答してください。

# コード編集ルール
- コード編集の提案時は、まず該当コードをReadし、その後EditまたはWriteで変更する
- 既存コードを理解してから変更を提案すること

# アクティブファイル
{activeEditorFile}（パス + 内容）

# プロジェクト情報
{claudeMdContent}
{agentsMdContent}
{readmeMdContent}

# ユーザー設定のシステムプロンプト
{userSystemPrompt}
```

### 10.3 アクティブエディタの自動付与

- `vscode.window.activeTextEditor` を監視
- エディタが切り替わるたびにコンテキストを更新
- 次回メッセージ送信時に最新のアクティブファイルを含む

---

## 11. ストリーミング設計

### 11.1 Webview⇔Extension 通信プロトコル

#### Webview → Extension (リクエスト)

```typescript
// メッセージ送信
{ command: "sendMessage", chatId: string, content: string, provider: ProviderType, attachments?: Attachment[] }

// チャット操作
{ command: "createChat" }
{ command: "loadChat", chatId: string }
{ command: "deleteChat", chatId: string }

// コンテキスト操作
{ command: "clearContext", chatId: string }
{ command: "compressContext", chatId: string }

// プロバイダー操作
{ command: "setProvider", provider: ProviderType }
{ command: "listModels", provider: ProviderType }

// 設定
{ command: "getSettings" }
{ command: "updateSettings", settings: Partial<AppSettings> }
{ command: "setApiKey", provider: ProviderType, apiKey: string }
{ command: "deleteApiKey", provider: ProviderType }
{ command: "testConnection", provider: ProviderType }

// MCP
{ command: "listMcpTools" }

// ストリーミング制御
{ command: "abortStream" }
```

#### Extension → Webview (レスポンス/イベント)

```typescript
// ストリーミングトークン
{ type: "token", chatId: string, messageId: string, content: string }

// ストリーミング完了
{ type: "streamEnd", chatId: string, messageId: string, fullContent: string }

// ツール呼び出し通知
{ type: "toolCall", chatId: string, messageId: string, toolCall: ToolCall }

// ツール結果通知
{ type: "toolResult", chatId: string, messageId: string, toolCallId: string, result: string }

// エラー
{ type: "error", chatId: string, error: string }

// チャット一覧更新
{ type: "chatListUpdate", chats: ChatMeta[] }

// モデル一覧
{ type: "modelList", provider: ProviderType, models: string[] }

// 設定
{ type: "settings", settings: AppSettings, hasApiKeys: Record<ProviderType, boolean> }
{ type: "connectionTestResult", provider: ProviderType, success: boolean, error?: string }

// アクティブエディタ変更
{ type: "activeEditorChanged", filePath: string, language: string }
```

### 11.2 ストリーミング処理フロー

```
[Webview]                    [Extension Host]                [AI Provider]
    │                              │                              │
    │─── sendMessage ─────────────►│                              │
    │                              │─── chat(stream: true) ──────►│
    │                              │                              │
    │                              │◄── token: "こん" ────────────│
    │◄── { type: "token" } ───────│                              │
    │                              │◄── token: "にちは" ──────────│
    │◄── { type: "token" } ───────│                              │
    │                              │◄── tool_use: read_file ─────│
    │◄── { type: "toolCall" } ────│                              │
    │                              │─── MCP executeTool ──────────│──► MCPサーバー
    │                              │◄── tool result ──────────────│◄── MCPサーバー
    │◄── { type: "toolResult" } ──│                              │
    │                              │─── continue with result ────►│
    │                              │◄── token: "結果は..." ───────│
    │◄── { type: "token" } ───────│                              │
    │                              │◄── [done] ──────────────────│
    │◄── { type: "streamEnd" } ───│                              │
    │                              │                              │
```

---

## 12. コンテキスト管理

### 12.1 手動クリア

- UIに「コンテキストクリア」ボタンを配置
- クリア後、以降のメッセージにはクリア前の会話履歴を含めない
- クリアされた履歴はJSON上には残る（表示用）がAPIには送信しない
- クリアポイントを `Message` に `contextClearMark: true` として記録

### 12.2 圧縮オプション

- UIに「コンテキストを圧縮」ボタンを配置
- 実行すると、現在の会話履歴をAIに要約させる
- 要約結果を `system` ロールのメッセージとして挿入
- 元の会話はAPIには送信しない（表示用に保持）
- 圧縮実行ログを会話内にインライン表示

---

## 13. 設定管理

### 13.1 設定の保存先

| 設定項目 | 保存先 | 理由 |
|---------|--------|------|
| API キー | VSCode SecretStorage | 暗号化が必要 |
| エンドポイント・モデル等 | `~/.hime/settings.json` | UI から直接読み書き |
| ストレージパス | VSCode `settings.json` | VSCode 管理が適切 |

### 13.2 VSCode 設定 (settings.json)

VSCode 設定として公開する項目は最小限:

```json
{
  "hime.storage.path": "~/.hime"
}
```

### 13.3 API キーの管理

- VSCode の `SecretStorage` API を使用して暗号化保存
- キー名: `hime.apiKey.{providerType}`（例: `hime.apiKey.anthropic`）
- 設定画面から入力・更新・削除が可能
- `settings.json` には一切書き込まない

---

## 14. package.json 拡張機能マニフェスト

### 14.1 主要設定

```json
{
  "name": "hime",
  "displayName": "Hime",
  "description": "AI Chat Extension for VSCode",
  "version": "0.1.0",
  "engines": { "vscode": "^1.96.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "hime-sidebar",
          "title": "Hime",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "hime-sidebar": [
        {
          "type": "webview",
          "id": "hime.chatView",
          "name": "Chat"
        }
      ]
    },
    "commands": [
      { "command": "hime.newChat", "title": "Hime: 新規チャット" },
      { "command": "hime.clearContext", "title": "Hime: コンテキストクリア" },
      { "command": "hime.compressContext", "title": "Hime: コンテキスト圧縮" },
      { "command": "hime.sendSelection", "title": "Hime: 選択範囲を送信" }
    ],
    "menus": {
      "editor/context": [
        { "command": "hime.sendSelection", "group": "hime" }
      ]
    },
    "configuration": {
      "title": "Hime",
      "properties": {}
    }
  }
}
```

---

## 15. ビルド・開発フロー

### 15.1 ビルドスクリプト

```json
{
  "scripts": {
    "compile": "npm run check-types && node esbuild.js",
    "check-types": "tsc --noEmit",
    "watch": "npm-run-all -p watch:ext watch:webview",
    "watch:ext": "node esbuild.js --watch",
    "watch:webview": "node esbuild.js --watch --webview",
    "package": "npm run check-types && node esbuild.js --production",
    "test": "vitest"
  }
}
```

### 15.2 esbuild 設定方針

- **Extension Host**: `platform: 'node'`, `format: 'cjs'`, `external: ['vscode']`
- **Webview**: `platform: 'browser'`, `format: 'iife'`, React JSXをバンドル

### 15.3 デバッグ

- F5で拡張機能開発ホストを起動
- Webview DevToolsは `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"

---

## 16. セキュリティ

### 16.1 APIキーの管理
- VSCode SecretStorage API を使用（`context.secrets`）
- settings.jsonへの平文保存は非推奨だが、自分専用ツールのため許容

### 16.2 Webview CSP
- Content Security Policy を設定し、外部リソースの読み込みを制限
- `nonce` ベースのスクリプト許可

### 16.3 MCP
- MCPサーバーはローカルプロセスとして起動（stdio transport）
- 信頼できるサーバーのみ設定に含める
