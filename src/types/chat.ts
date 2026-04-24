export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  provider: ProviderType;
  systemPrompt?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: ProviderType;
  model?: string;
  timestamp: string;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  reactions?: Reaction[];
  contextClearMark?: boolean;
  usage?: TokenUsage;
}

export interface Attachment {
  type: "file" | "image";
  name: string;
  path: string;
  mimeType: string;
  content?: string;
  base64?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
  result?: string;
  error?: string;
}

export interface Reaction {
  type: "thumbsUp" | "thumbsDown";
  messageId: string;
}

export interface ChatMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: ProviderType;
  messageCount: number;
}

export interface ChatsIndex {
  chats: ChatMeta[];
}

export type ProviderType =
  | "anthropic"
  | "openai"
  | "azure-openai"
  | "azure-openai-custom"
  | "ollama"
  | "openrouter"
  | "google"
  | "xai"
  | "custom";

export interface ModelEntry {
  id: string;
  provider: ProviderType;
  model: string;
  endpoint?: string;
  deploymentName?: string;
  displayName: string;
}

export const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  "azure-openai": "Azure OpenAI",
  "azure-openai-custom": "Azure OpenAI (Custom)",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  google: "Google Gemini",
  xai: "xAI (Grok)",
  custom: "Custom",
};

export function generateModelDisplayName(provider: ProviderType, model: string): string {
  return `${PROVIDER_DISPLAY_NAMES[provider]} / ${model}`;
}
