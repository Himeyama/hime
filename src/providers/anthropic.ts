import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class AnthropicProvider extends VercelBaseProvider {
  readonly type: ProviderType = "anthropic";
  readonly displayName = "Anthropic";

  protected createModel(): LanguageModel {
    return createAnthropic({
      apiKey: this.config.apiKey,
      ...(this.config.endpoint ? { baseURL: this.config.endpoint } : {}),
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ];
  }

  async testConnection(): Promise<boolean> {
    await generateText({
      model: this.createModel(),
      prompt: "hi",
      maxOutputTokens: 16,
    });
    return true;
  }
}
