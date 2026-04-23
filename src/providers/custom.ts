import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class CustomProvider extends VercelBaseProvider {
  readonly type: ProviderType = "custom";
  readonly displayName = "Custom";

  protected createModel(): LanguageModel {
    return createOpenAI({
      apiKey: this.config.apiKey || "dummy",
      baseURL: this.config.endpoint || "http://localhost:11434/v1",
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    return [];
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
