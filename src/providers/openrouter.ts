import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import OpenAI from "openai";
import { VercelBaseProvider } from "./vercel-base";
import { DEFAULT_ENDPOINTS } from "../types/provider";
import type { ProviderType } from "../types/chat";

export class OpenRouterProvider extends VercelBaseProvider {
  readonly type: ProviderType = "openrouter";
  readonly displayName = "OpenRouter";

  protected createModel(): LanguageModel {
    return createOpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.endpoint || DEFAULT_ENDPOINTS.openrouter,
      headers: {
        "HTTP-Referer": "https://github.com/hikari/hime",
        "X-Title": "Hime",
      },
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    try {
      const client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.endpoint || DEFAULT_ENDPOINTS.openrouter,
        defaultHeaders: {
          "HTTP-Referer": "https://github.com/hikari/hime",
          "X-Title": "Hime",
        },
      });
      const response = await client.models.list();
      const models: string[] = [];
      for await (const model of response) {
        models.push(model.id);
      }
      return models.sort();
    } catch {
      return [];
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
