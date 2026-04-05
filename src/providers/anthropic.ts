import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./base";
import { SystemPrompt } from "../types/provider";
import { Message, ProviderType, ToolCall } from "../types/chat";

export class AnthropicProvider extends BaseProvider {
  readonly type: ProviderType = "anthropic";
  readonly displayName = "Anthropic";

  private createClient(): Anthropic {
    return new Anthropic({
      apiKey: this.config.apiKey,
      ...(this.config.endpoint ? { baseURL: this.config.endpoint } : {}),
    });
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === "user") {
        result.push({
          role: "user",
          content: m.content,
        });
      } else if (m.role === "assistant") {
        const content: Anthropic.MessageParam["content"] = [];

        if (m.content) {
          content.push({ type: "text", text: m.content });
        }

        if (m.toolCalls && m.toolCalls.length > 0) {
          m.toolCalls.forEach((tc) => {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          });
        }

        result.push({
          role: "assistant",
          content,
        });

        // If there are tool calls, we MUST follow with a tool_result in a user message
        if (m.toolCalls && m.toolCalls.length > 0) {
          const toolResults: Anthropic.ToolResultBlockParam[] = m.toolCalls.map((tc) => ({
            type: "tool_result",
            tool_use_id: tc.id,
            content: tc.result || tc.error || "No result",
            is_error: tc.status === "error",
          }));

          result.push({
            role: "user",
            content: toolResults,
          });
        }
      }
    }

    return result;
  }

  async chat(
    messages: Message[],
    systemPrompt: SystemPrompt,
    onToken: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => Promise<string>,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message> {
    const client = this.createClient();
    let currentMessages = this.convertMessages(messages);
    let fullContent = "";
    const allToolCalls: ToolCall[] = [];
    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      iteration++;
      let currentIterationContent = "";
      const currentIterationToolCalls: ToolCall[] = [];
      let currentJsonBuffer = "";

      const stream = client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 8192,
        system:
          typeof systemPrompt === "string"
            ? [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" } }]
            : [
                { type: "text" as const, text: systemPrompt.staticPart, cache_control: { type: "ephemeral" } },
                { type: "text" as const, text: systemPrompt.dynamicPart, cache_control: { type: "ephemeral" } },
              ],
        messages: currentMessages,
        tools:
          tools && tools.length > 0
            ? tools.map((t: any, i: number) =>
                i === tools.length - 1
                  ? { ...t, cache_control: { type: "ephemeral" } }
                  : t
              )
            : tools,
      });

      if (signal) {
        const abortHandler = () => stream.abort();
        signal.addEventListener("abort", abortHandler);
      }

      for await (const event of stream) {
        if (signal?.aborted) break;

        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          currentIterationContent += event.delta.text;
          fullContent += event.delta.text;
          onToken(event.delta.text);
        }

        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          const block = event.content_block;
          currentIterationToolCalls.push({
            id: block.id,
            name: block.name,
            arguments: {},
            status: "running",
          });
          currentJsonBuffer = "";
        }

        if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
          currentJsonBuffer += event.delta.partial_json;
        }

        if (event.type === "content_block_stop") {
          const currentToolCall = currentIterationToolCalls[currentIterationToolCalls.length - 1];
          if (currentToolCall && currentJsonBuffer) {
            try {
              currentToolCall.arguments = JSON.parse(currentJsonBuffer);
            } catch {
              // Keep empty
            }
            currentJsonBuffer = "";
          }
        }
      }

      allToolCalls.push(...currentIterationToolCalls);

      if (currentIterationToolCalls.length === 0) {
        // No more tools, we're done
        break;
      }

      // Prepare next iteration by adding tool results
      const assistantBlocks: any[] = [];
      if (currentIterationContent) {
        assistantBlocks.push({ type: "text", text: currentIterationContent });
      }

      const toolResultBlocks: any[] = [];

      for (const tc of currentIterationToolCalls) {
        assistantBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });

        if (onToolCall) {
          try {
            const result = await onToolCall(tc);
            tc.status = "completed";
            tc.result = result;
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: result,
            });
          } catch (err: any) {
            tc.status = "error";
            tc.error = err.message || String(err);
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: tc.error,
              is_error: true,
            });
          }
        }
      }

      currentMessages.push({ role: "assistant", content: assistantBlocks });
      currentMessages.push({ role: "user", content: toolResultBlocks });
    }

    return this.createAssistantMessage(fullContent, allToolCalls.length > 0 ? allToolCalls : undefined);
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-haiku-4-20250514",
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = this.createClient();
      await client.messages.create({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch (err) {
      throw err;
    }
  }
}
