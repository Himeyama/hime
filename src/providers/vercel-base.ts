import { streamText, generateText, tool, jsonSchema, stepCountIs } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import { BaseProvider } from "./base";
import type { SystemPrompt } from "../types/provider";
import type { Message, ToolCall } from "../types/chat";

export abstract class VercelBaseProvider extends BaseProvider {
  protected abstract createModel(): LanguageModel;

  protected himeToModelMessages(messages: Message[]): ModelMessage[] {
    const result: ModelMessage[] = [];

    for (const m of messages) {
      if (m.role === "system") continue;

      if (m.role === "user") {
        result.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const parts: any[] = [];

        if (m.content) {
          parts.push({ type: "text", text: m.content });
        }
        if (m.toolCalls?.length) {
          for (const tc of m.toolCalls) {
            parts.push({ type: "tool-call", toolCallId: tc.id, toolName: tc.name, input: tc.arguments });
          }
        }

        if (parts.length === 0) continue;
        result.push({ role: "assistant", content: parts });

        if (m.toolCalls?.length) {
          result.push({
            role: "tool",
            content: m.toolCalls.map((tc) => ({
              type: "tool-result" as const,
              toolCallId: tc.id,
              toolName: tc.name,
              output: { type: "text" as const, value: tc.result ?? tc.error ?? "No result" },
            })),
          });
        }
      }
    }

    return result;
  }

  protected buildVercelTools(
    tools: any[] | undefined,
    onToolCall: ((tc: ToolCall) => Promise<string>) | undefined,
    toolCallsById: Map<string, ToolCall>
  ): Record<string, any> | undefined {
    if (!tools || tools.length === 0 || !onToolCall) return undefined;

    const result: Record<string, any> = {};

    for (const t of tools) {
      // OpenAI format: { type: "function", function: { name, description, parameters } }
      // Anthropic format: { name, description, input_schema }
      const name: string = t.function?.name ?? t.name;
      const description: string = t.function?.description ?? t.description ?? "";
      const schema: Record<string, unknown> = t.function?.parameters ?? t.input_schema ?? {};
      const toolName = name;

      result[name] = tool({
        description,
        inputSchema: jsonSchema(schema as any),
        execute: async (input: unknown, options: any) => {
          const tc = toolCallsById.get(options?.toolCallId as string);
          if (!tc) return "Tool call not found";
          try {
            const res = await onToolCall(tc);
            tc.status = "completed";
            tc.result = res;
            return res;
          } catch (err: any) {
            tc.status = "error";
            tc.error = err.message || String(err);
            return `Error: ${tc.error}`;
          }
        },
      });
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
    const model = this.createModel();
    const resolvedSystem = this.resolveSystemPrompt(systemPrompt);
    const modelMessages = this.himeToModelMessages(messages);
    const allToolCalls: ToolCall[] = [];
    const toolCallsById = new Map<string, ToolCall>();
    const vercelTools = this.buildVercelTools(tools, onToolCall, toolCallsById);
    let fullContent = "";

    const result = streamText({
      model,
      system: resolvedSystem,
      messages: modelMessages,
      ...(vercelTools ? { tools: vercelTools } : {}),
      stopWhen: stepCountIs(10),
      maxOutputTokens: 8192,
      abortSignal: signal,
    });

    for await (const chunk of result.fullStream) {
      if (signal?.aborted) break;
      if (chunk.type === "text-delta") {
        fullContent += chunk.text;
        onToken(chunk.text);
      } else if (chunk.type === "tool-call") {
        const tc: ToolCall = {
          id: chunk.toolCallId,
          name: chunk.toolName,
          arguments: ((chunk as any).input as Record<string, unknown>) ?? {},
          status: "running",
        };
        allToolCalls.push(tc);
        toolCallsById.set(tc.id, tc);
        onToolCallStart?.(tc);
      }
    }

    let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    try {
      const u = await result.totalUsage;
      usage = {
        inputTokens: u.inputTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        cacheReadTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
        cacheWriteTokens: u.inputTokenDetails?.cacheWriteTokens ?? 0,
      };
    } catch {}

    return this.createAssistantMessage(
      fullContent,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      usage
    );
  }
}
