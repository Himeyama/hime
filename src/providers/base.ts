import * as crypto from "crypto";
import { AIProvider, ProviderConfig, SystemPrompt } from "../types/provider";
import { Message, ProviderType, ToolCall, TokenUsage } from "../types/chat";

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
    systemPrompt: SystemPrompt,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => Promise<string>,
    onToolCallStart?: (toolCall: ToolCall) => void,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message>;

  abstract listModels(): Promise<string[]>;
  abstract testConnection(): Promise<boolean>;

  protected resolveSystemPrompt(systemPrompt: SystemPrompt): string {
    if (typeof systemPrompt === "string") return systemPrompt;
    return systemPrompt.staticPart + "\n\n" + systemPrompt.dynamicPart;
  }

  protected createAssistantMessage(
    content: string,
    toolCalls?: ToolCall[],
    usage?: TokenUsage
  ): Message {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      provider: this.type,
      model: this.config.model,
      timestamp: new Date().toISOString(),
      toolCalls,
      usage,
    };
  }
}
