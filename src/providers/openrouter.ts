import OpenAI from "openai";
import { BaseProvider } from "./base";
import { ProviderConfig, DEFAULT_ENDPOINTS, SystemPrompt } from "../types/provider";
import { Message, ProviderType, ToolCall, TokenUsage } from "../types/chat";

export class OpenRouterProvider extends BaseProvider {
  readonly type: ProviderType = "openrouter";
  readonly displayName = "OpenRouter";

  protected createClient(): OpenAI {
    return new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.endpoint || DEFAULT_ENDPOINTS.openrouter,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/hikari/hime",
        "X-Title": "Hime",
      },
    });
  }

  protected convertMessages(
    messages: Message[],
    systemPrompt: string | SystemPrompt
  ): OpenAI.ChatCompletionMessageParam[] {
    const resolved = typeof systemPrompt === "string" ? systemPrompt : this.resolveSystemPrompt(systemPrompt);
    const result: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [
          { type: "text", text: resolved, cache_control: { type: "ephemeral" } } as any,
        ],
      },
    ];

    for (const m of messages) {
      if (m.role === "user") {
        result.push({
          role: "user",
          content: m.content,
        });
      } else if (m.role === "assistant") {
        const assistantMessage: OpenAI.ChatCompletionAssistantMessageParam = {
          role: "assistant",
          content: m.content || null,
        };

        if (m.toolCalls && m.toolCalls.length > 0) {
          assistantMessage.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }

        result.push(assistantMessage);

        if (m.toolCalls && m.toolCalls.length > 0) {
          m.toolCalls.forEach((tc) => {
            result.push({
              role: "tool",
              tool_call_id: tc.id,
              content: tc.result || tc.error || "No result",
            });
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
    onToolCallStart?: (toolCall: ToolCall) => void,
    signal?: AbortSignal,
    tools?: any[]
  ): Promise<Message> {
    const client = this.createClient();
    let currentMessages = this.convertMessages(messages, systemPrompt);
    let fullContent = "";
    const allToolCalls: ToolCall[] = [];
    let iteration = 0;
    const maxIterations = 10;
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

    while (iteration < maxIterations) {
      iteration++;
      let currentIterationContent = "";
      const currentIterationToolCalls: ToolCall[] = [];
      const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();

      const stream = await client.chat.completions.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens || 8192,
          messages: currentMessages,
          stream: true,
          stream_options: { include_usage: true },
          ...(tools && tools.length > 0 ? { tools } : {}),
        },
        { signal }
      );

      for await (const chunk of stream) {
        if (signal?.aborted) break;

        if (chunk.usage) {
          totalUsage.inputTokens += chunk.usage.prompt_tokens ?? 0;
          totalUsage.outputTokens += chunk.usage.completion_tokens ?? 0;
          totalUsage.cacheReadTokens = (totalUsage.cacheReadTokens ?? 0) + ((chunk.usage as any).prompt_tokens_details?.cached_tokens ?? 0);
        }

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          currentIterationContent += delta.content;
          fullContent += delta.content;
          onToken(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;

            if (!toolCallBuffers.has(idx)) {
              toolCallBuffers.set(idx, {
                id: tc.id || "",
                name: tc.function?.name || "",
                args: "",
              });
            }

            const buffer = toolCallBuffers.get(idx)!;
            if (tc.id) buffer.id = tc.id;
            if (tc.function?.name) buffer.name = tc.function.name;
            if (tc.function?.arguments) buffer.args += tc.function.arguments;
          }
        }
      }

      // Finalize tool calls
      for (const [, buffer] of toolCallBuffers) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(buffer.args);
        } catch {
          // Keep empty args
        }

        const toolCall: ToolCall = {
          id: buffer.id,
          name: buffer.name,
          arguments: parsedArgs,
          status: "running",
        };
        currentIterationToolCalls.push(toolCall);
        
        if (onToolCallStart) {
          onToolCallStart(toolCall);
        }
      }

      allToolCalls.push(...currentIterationToolCalls);

      if (currentIterationToolCalls.length === 0) {
        break;
      }

      // Execute tools and add to history
      const assistantMessage: OpenAI.ChatCompletionAssistantMessageParam = {
        role: "assistant",
        content: currentIterationContent || null,
        tool_calls: currentIterationToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };

      currentMessages.push(assistantMessage);

      for (const tc of currentIterationToolCalls) {
        if (onToolCall) {
          try {
            const result = await onToolCall(tc);
            tc.status = "completed";
            tc.result = result;
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result || "",
            });
          } catch (err: any) {
            tc.status = "error";
            tc.error = err.message || String(err);
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: tc.error || "Unknown error",
            });
          }
        }
      }
    }

    return this.createAssistantMessage(
      fullContent,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      totalUsage
    );
  }

  async listModels(): Promise<string[]> {
    try {
      const client = this.createClient();
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
    try {
      const client = this.createClient();
      await client.chat.completions.create({
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
