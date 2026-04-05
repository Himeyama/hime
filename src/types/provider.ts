import { ProviderType, Message, ToolCall } from "./chat";

export type SystemPrompt = string | { staticPart: string; dynamicPart: string };

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  endpoint?: string;
  deploymentName?: string;
  model: string;
  maxTokens?: number;
}

export interface AIProvider {
  readonly type: ProviderType;
  readonly displayName: string;

  chat(
    messages: Message[],
    systemPrompt: SystemPrompt,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => Promise<string>,
    onToolCallStart?: (toolCall: ToolCall) => void,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message>;

  listModels(): Promise<string[]>;

  testConnection(): Promise<boolean>;
}

export const DEFAULT_ENDPOINTS: Record<ProviderType, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  "azure-openai": "",
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  google: "",
};

export const DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  "azure-openai": "gpt-4o",
  ollama: "llama3.1",
  openrouter: "anthropic/claude-sonnet-4-5",
  google: "gemini-2.5-flash",
};
