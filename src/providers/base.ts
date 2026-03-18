import * as crypto from "crypto";
import { AIProvider, ProviderConfig } from "../types/provider";
import { Message, ProviderType, ToolCall } from "../types/chat";

export abstract class BaseProvider implements AIProvider {
  abstract readonly type: ProviderType;
  abstract readonly displayName: string;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  abstract chat(
    messages: Message[],
    systemPrompt: string,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => Promise<string>,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message>;

  abstract listModels(): Promise<string[]>;
  abstract testConnection(): Promise<boolean>;

  protected createAssistantMessage(
    content: string,
    toolCalls?: ToolCall[]
  ): Message {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      provider: this.type,
      model: this.config.model,
      timestamp: new Date().toISOString(),
      toolCalls,
    };
  }
}
