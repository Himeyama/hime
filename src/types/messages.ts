import { ProviderType, Attachment, ChatMeta, ToolCall, ModelEntry } from "./chat";
import { MCPServerConfig } from "./mcp";

// Webview → Extension
export type WebviewToExtensionMessage =
  | { command: "sendMessage"; chatId: string; content: string; modelId: string; attachments?: Attachment[] }
  | { command: "createChat" }
  | { command: "loadChat"; chatId: string }
  | { command: "deleteChat"; chatId: string }
  | { command: "clearContext"; chatId: string }
  | { command: "compressContext"; chatId: string }
  | { command: "setDefaultModel"; modelId: string }
  | { command: "saveModel"; entry: Omit<ModelEntry, "id" | "displayName">; apiKey?: string }
  | { command: "deleteModel"; modelId: string }
  | { command: "reorderModels"; modelIds: string[] }
  | { command: "getSettings" }
  | { command: "updateSettings"; settings: Partial<AppSettings> }
  | { command: "deleteApiKey"; provider: ProviderType }
  | { command: "testConnection"; modelId: string }
  | { command: "listMcpTools" }
  | { command: "reconnectMcp" }
  | { command: "abortStream" }
  | { command: "openSettingsJson" }
  | { command: "addReaction"; chatId: string; messageId: string; reaction: "thumbsUp" | "thumbsDown" }
  | { command: "getChatList" }
  | { command: "getMcpStatus" }
  | { command: "executeSkill"; chatId: string; skillName: string; args: string; modelId: string }
  | { command: "listSkills" }
  | { command: "listHelp" }
  | { command: "openInBrowser"; content: string }
  | { command: "setPreviewContent"; content: string };



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
  | { type: "settings"; settings: AppSettings; hasApiKeys: Record<ProviderType, boolean> }
  | { type: "connectionTestResult"; modelId: string; success: boolean; error?: string }
  | { type: "activeEditorChanged"; filePath: string; language: string }
  | { type: "mcpTools"; tools: import("./mcp").MCPTool[] }
  | { type: "mcpStatus"; servers: { name: string; status: "connected" | "disconnected" | "error" | "disabled"; toolCount: number }[] }
  | { type: "projectContextLoaded"; files: string[] }
  | { type: "skillsList"; content: string }
  | { type: "skillExecuted"; chatId: string; skillName: string; expandedPrompt: string }
  | { type: "helpContent"; content: string }
  | { type: "fillInput"; content: string; submit?: boolean }
  | { type: "previewServerReady"; url: string };

export interface AppSettings {
  defaultModelId: string;
  models: ModelEntry[];
  systemPrompt: string;
  fontFamily?: "serif" | "sans-serif";
  mcpServers?: Record<string, MCPServerConfig>;
  autoLoadProjectFiles?: boolean;
}
