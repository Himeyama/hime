import { ProviderType } from "../types/chat";
import { AIProvider, ProviderConfig, DEFAULT_MODELS } from "../types/provider";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { AzureOpenAIProvider } from "./azure-openai";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "azure-openai":
      return new AzureOpenAIProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
  }
}

export { AnthropicProvider, OpenAIProvider, AzureOpenAIProvider, OllamaProvider, OpenRouterProvider };
