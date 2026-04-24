import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import OpenAI from "openai";
import { VercelBaseProvider } from "./vercel-base";
import { DEFAULT_ENDPOINTS } from "../types/provider";
import type { ProviderType } from "../types/chat";

export class XAIProvider extends VercelBaseProvider {
  readonly type: ProviderType = "xai";
  readonly displayName = "xAI (Grok)";

  protected createModel(): LanguageModel {
    return createOpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.endpoint || DEFAULT_ENDPOINTS.xai,
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    try {
      const client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.endpoint || DEFAULT_ENDPOINTS.xai,
      });
      const response = await client.models.list();
      const models: string[] = [];
      for await (const model of response) {
        models.push(model.id);
      }
      return models.sort();
    } catch {
      return [
        "grok-3",
        "grok-3-fast",
        "grok-3-mini",
        "grok-3-mini-fast",
        "grok-2-1212",
        "grok-2-vision-1212",
      ];
    }
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
