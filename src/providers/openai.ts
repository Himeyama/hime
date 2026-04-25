import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import OpenAI from "openai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";
import { Agent } from "undici";
import * as dns from "dns";

// Force IPv4 resolution for OpenAI to prevent IPv6 blackhole timeouts in Node.js 18+ fetch
const ipv4Agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
  },
});

const customFetch = (url: RequestInfo | URL, init?: RequestInit) => {
  return fetch(url, { ...init, dispatcher: ipv4Agent } as any);
};

export class OpenAIProvider extends VercelBaseProvider {
  readonly type: ProviderType = "openai";
  readonly displayName = "OpenAI";

  protected createModel(): LanguageModel {
    return createOpenAI({
      apiKey: this.config.apiKey,
      fetch: customFetch,
      ...(this.config.endpoint ? { baseURL: this.config.endpoint } : {}),
    })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    try {
      const client = new OpenAI({
        apiKey: this.config.apiKey,
        fetch: customFetch,
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
