import { Ollama } from "ollama";
import { BaseProvider } from "./base";
import { ProviderConfig } from "../types/provider";
import { Message, ProviderType, ToolCall } from "../types/chat";

export class OllamaProvider extends BaseProvider {
  readonly type: ProviderType = "ollama";
  readonly displayName = "Ollama";

  private createClient(): Ollama {
    return new Ollama({
      host: this.config.endpoint || "http://localhost:11434",
    });
  }

  private convertMessages(
    messages: Message[],
    systemPrompt: string
  ): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const m of messages) {
      if (m.role === "user" || m.role === "assistant") {
        result.push({
          role: m.role,
          content: m.content,
        });
      }
    }

    return result;
  }

  async chat(
    messages: Message[],
    systemPrompt: string,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void,
    signal?: AbortSignal
  ): Promise<Message> {
    const client = this.createClient();
    const convertedMessages = this.convertMessages(messages, systemPrompt);
    let fullContent = "";

    const response = await client.chat({
      model: this.config.model,
      messages: convertedMessages,
      stream: true,
    });

    for await (const chunk of response) {
      if (signal?.aborted) {
        break;
      }

      if (chunk.message?.content) {
        fullContent += chunk.message.content;
        onToken(chunk.message.content);
      }
    }

    return this.createAssistantMessage(fullContent);
  }

  async listModels(): Promise<string[]> {
    try {
      const client = this.createClient();
      const response = await client.list();
      return response.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = this.createClient();
      await client.list();
      return true;
    } catch {
      return false;
    }
  }
}
