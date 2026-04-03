import * as crypto from "crypto";
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
  ): { role: string; content: string; tool_calls?: any[] }[] {
    const result: { role: string; content: string; tool_calls?: any[] }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const m of messages) {
      if (m.role === "user") {
        result.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const msg: { role: string; content: string; tool_calls?: any[] } = {
          role: "assistant",
          content: m.content || "",
        };
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.tool_calls = m.toolCalls.map((tc) => ({
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        result.push(msg);

        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            result.push({
              role: "tool",
              content: tc.result || tc.error || "No result",
            });
          }
        }
      }
    }

    return result;
  }

  async chat(
    messages: Message[],
    systemPrompt: string,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => Promise<string>,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message> {
    const client = this.createClient();
    let currentMessages = this.convertMessages(messages, systemPrompt);
    let fullContent = "";
    const allToolCalls: ToolCall[] = [];
    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      iteration++;
      let currentIterationContent = "";
      const currentIterationToolCalls: ToolCall[] = [];
      const streamedToolCalls: Array<{ name: string; arguments: Record<string, any> }> = [];

      const stream = await client.chat({
        model: this.config.model,
        messages: currentMessages as any,
        stream: true,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      for await (const chunk of stream) {
        if (signal?.aborted) break;

        if (chunk.message?.content) {
          currentIterationContent += chunk.message.content;
          fullContent += chunk.message.content;
          onToken(chunk.message.content);
        }

        if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
          for (const tc of chunk.message.tool_calls) {
            streamedToolCalls.push({
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
          }
        }
      }

      for (const tc of streamedToolCalls) {
        currentIterationToolCalls.push({
          id: crypto.randomUUID(),
          name: tc.name,
          arguments: tc.arguments,
          status: "running",
        });
      }

      allToolCalls.push(...currentIterationToolCalls);

      if (currentIterationToolCalls.length === 0) {
        break;
      }

      currentMessages.push({
        role: "assistant",
        content: currentIterationContent || "",
        tool_calls: currentIterationToolCalls.map((tc) => ({
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const tc of currentIterationToolCalls) {
        if (onToolCall) {
          try {
            const result = await onToolCall(tc);
            tc.status = "completed";
            tc.result = result;
            currentMessages.push({ role: "tool", content: result || "" });
          } catch (err: any) {
            tc.status = "error";
            tc.error = err.message || String(err);
            currentMessages.push({ role: "tool", content: tc.error || "Unknown error" });
          }
        }
      }
    }

    return this.createAssistantMessage(
      fullContent,
      allToolCalls.length > 0 ? allToolCalls : undefined
    );
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
    } catch (err) {
      throw err;
    }
  }
}
