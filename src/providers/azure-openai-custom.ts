import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class AzureOpenAICustomProvider extends VercelBaseProvider {
  readonly type: ProviderType = "azure-openai-custom";
  readonly displayName = "Azure OpenAI (Custom)";

  protected createModel(): LanguageModel {
    return createOpenAI({
      baseURL: this.config.endpoint,
      headers: {
        "api-key": this.config.apiKey || "",
      },
    }).chat(this.config.model);
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
