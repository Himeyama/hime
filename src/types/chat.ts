export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  provider: ProviderType;
  systemPrompt?: string;
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

export type ProviderType = "anthropic" | "openai" | "azure-openai" | "ollama" | "openrouter";
