import { ProviderType } from "../types/chat";
import { AIProvider, ProviderConfig } from "../types/provider";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { AzureOpenAIProvider } from "./azure-openai";
import { AzureOpenAICustomProvider } from "./azure-openai-custom";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";
import { GoogleProvider } from "./google";
import { XAIProvider } from "./xai";
import { CustomProvider } from "./custom";

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "azure-openai":
      return new AzureOpenAIProvider(config);
    case "azure-openai-custom":
      return new AzureOpenAICustomProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "google":
      return new GoogleProvider(config);
    case "xai":
      return new XAIProvider(config);
    case "custom":
      return new CustomProvider(config);
  }
}

export {
  AnthropicProvider,
  OpenAIProvider,
  AzureOpenAIProvider,
  AzureOpenAICustomProvider,
  OllamaProvider,
  OpenRouterProvider,
  GoogleProvider,
  XAIProvider,
  CustomProvider,
};
