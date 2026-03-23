import { ProviderType, Attachment, ChatMeta, ToolCall } from "./chat";

// Webview → Extension
export type WebviewToExtensionMessage =
  | { command: "sendMessage"; chatId: string; content: string; provider: ProviderType; attachments?: Attachment[] }
  | { command: "createChat" }
  | { command: "loadChat"; chatId: string }
  | { command: "deleteChat"; chatId: string }
  | { command: "clearContext"; chatId: string }
  | { command: "compressContext"; chatId: string }
  | { command: "setProvider"; provider: ProviderType }
  | { command: "listModels"; provider: ProviderType }
  | { command: "getSettings" }
  | { command: "updateSettings"; settings: Partial<AppSettings> }
  | { command: "setApiKey"; provider: ProviderType; apiKey: string }
  | { command: "deleteApiKey"; provider: ProviderType }
  | { command: "testConnection"; provider: ProviderType }
  | { command: "listMcpTools" }
  | { command: "reconnectMcp" }
  | { command: "abortStream" }
  | { command: "openSettingsJson" }
  | { command: "addReaction"; chatId: string; messageId: string; reaction: "thumbsUp" | "thumbsDown" }
  | { command: "getChatList" };

// Extension → Webview
export type ExtensionToWebviewMessage =
  | { type: "token"; chatId: string; messageId: string; content: string }
  | { type: "streamEnd"; chatId: string; messageId: string; fullContent: string; toolCalls?: import("./chat").ToolCall[] }
  | { type: "toolCall"; chatId: string; messageId: string; toolCall: ToolCall }
  | { type: "toolResult"; chatId: string; messageId: string; toolCallId: string; result: string; isError?: boolean }
  | { type: "error"; chatId: string; error: string }
  | { type: "chatListUpdate"; chats: ChatMeta[] }
  | { type: "chatLoaded"; chat: import("./chat").Chat }
  | { type: "chatCreated"; chat: import("./chat").Chat }
  | { type: "modelList"; provider: ProviderType; models: string[] }
  | { type: "settings"; settings: AppSettings; hasApiKeys: Record<ProviderType, boolean> }
  | { type: "connectionTestResult"; provider: ProviderType; success: boolean; error?: string }
  | { type: "activeEditorChanged"; filePath: string; language: string }
  | { type: "mcpTools"; tools: import("./mcp").MCPTool[] }
  | { type: "mcpStatus"; servers: { name: string; status: "connected" | "disconnected" | "error"; toolCount: number }[] }
  | { type: "projectContextLoaded"; files: string[] };

export interface ProviderSettings {
  endpoint?: string;
  deploymentName?: string;
  model: string;
}

export interface MCPServerSettingConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AppSettings {
  defaultProvider: ProviderType;
  providers: Record<ProviderType, ProviderSettings>;
  systemPrompt: string;
  mcpServers?: Record<string, MCPServerSettingConfig>;
}
