import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import OpenAI from "openai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class OpenAIProvider extends VercelBaseProvider {
  readonly type: ProviderType = "openai";
  readonly displayName = "OpenAI";

  protected createModel(): LanguageModel {
    return createOpenAI({
      apiKey: this.config.apiKey,
      ...(this.config.endpoint ? { baseURL: this.config.endpoint } : {}),
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    try {
      const client = new OpenAI({
        apiKey: this.config.apiKey,
        ...(this.config.endpoint ? { baseURL: this.config.endpoint } : {}),
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
