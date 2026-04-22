import { generateText } from "ai";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

export class AzureOpenAIProvider extends VercelBaseProvider {
  readonly type: ProviderType = "azure-openai";
  readonly displayName = "Azure OpenAI";

  protected createModel(): LanguageModel {
    return createAzure({
      baseURL: this.config.endpoint,
      apiKey: this.config.apiKey,
      apiVersion: "2024-06-01",
      useDeploymentBasedUrls: true,
    })(this.config.deploymentName || this.config.model);
  }

  async listModels(): Promise<string[]> {
    return ["o1-preview", "o1-mini", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-35-turbo"];
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
