import { generateText } from "ai";
import { AzureOpenAIProviderSettings, createAzure } from "@ai-sdk/azure";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class AzureOpenAIProvider extends VercelBaseProvider {
  readonly type: ProviderType = "azure-openai";
  readonly displayName = "Azure OpenAI";

  protected createModel(): LanguageModel {
    if (this.config.deploymentName) {
      return createAzure({
        baseURL: this.config.endpoint,
        apiKey: this.config.apiKey,
        apiVersion: "2024-06-01",
      })(this.config.deploymentName);
    }

    return createAzure({
      baseURL: this.config.endpoint,
      apiKey: this.config.apiKey,
      apiVersion: "2024-06-01",
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(this.config.endpoint!, init);
      }
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    return ["gpt-5-mini", "gpt-5.1", "gpt-5.4-mini", "gpt-5.4", "gpt-5.4-nano"];
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
