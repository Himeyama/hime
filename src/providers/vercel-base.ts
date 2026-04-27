import { streamText, tool, jsonSchema, stepCountIs } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import { BaseProvider } from "./base";
import type { SystemPrompt } from "../types/provider";
import type { Message, ToolCall } from "../types/chat";

export abstract class VercelBaseProvider extends BaseProvider {
  protected abstract createModel(): LanguageModel;

  // Set true in providers where the SDK's internal multi-step generates incompatible
  // message types (e.g. item_reference for Ollama's OpenAI-compatible endpoint).
  protected readonly useManualToolLoop: boolean = false;

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
    onToolCallStart: ((tc: ToolCall) => void) | undefined,
    allToolCalls: ToolCall[]
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
          const tc: ToolCall = {
            id: (options?.toolCallId as string) ?? "",
            name: toolName,
            arguments: (input as Record<string, unknown>) ?? {},
            status: "running",
          };
          allToolCalls.push(tc);
          onToolCallStart?.(tc);
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

  // Tool definitions without execute callbacks — used by the manual tool loop to prevent
  // the SDK from running its own multi-step continuation (which can emit item_reference
  // message types that some OpenAI-compatible endpoints don't accept).
  protected buildVercelToolDefsOnly(tools: any[] | undefined): Record<string, any> | undefined {
    if (!tools || tools.length === 0) return undefined;

    const result: Record<string, any> = {};
    for (const t of tools) {
      const name: string = t.function?.name ?? t.name;
      const description: string = t.function?.description ?? t.description ?? "";
      const schema: Record<string, unknown> = t.function?.parameters ?? t.input_schema ?? {};
      result[name] = tool({ description, inputSchema: jsonSchema(schema as any) });
    }
    return result;
  }

  private async consumeStream(
    stream: ReturnType<typeof streamText>,
    signal: AbortSignal | undefined,
    onToken: (token: string) => void,
    outContent: { value: string }
  ): Promise<void> {
    for await (const chunk of stream.fullStream) {
      if (signal?.aborted) break;
      if (chunk.type === "text-delta") {
        outContent.value += chunk.text;
        onToken(chunk.text);
      } else if (chunk.type === "error") {
        throw chunk.error;
      }
    }
  }

  // Manual tool loop: runs one streamText call per step, collects tool-call chunks,
  // executes tools, and feeds results back without relying on SDK internal multi-step.
  protected async chatManualToolLoop(
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
    let currentMessages: any[] = this.himeToModelMessages(messages);
    const allToolCalls: ToolCall[] = [];
    let fullContent = "";

    const vercelToolDefs = this.buildVercelToolDefsOnly(tools);

    for (let step = 0; step < 10; step++) {
      if (signal?.aborted) break;

      type StepToolCall = { toolCallId: string; toolName: string; input: Record<string, unknown> };
      const stepToolCalls: StepToolCall[] = [];
      let stepContent = "";

      const result = streamText({
        model,
        system: resolvedSystem,
        messages: currentMessages,
        ...(vercelToolDefs && onToolCall ? { tools: vercelToolDefs } : {}),
        maxOutputTokens: 16384,
        abortSignal: signal,
      });

      for await (const chunk of result.fullStream) {
        if (signal?.aborted) break;
        if (chunk.type === "text-delta") {
          stepContent += chunk.text;
          fullContent += chunk.text;
          onToken(chunk.text);
        } else if (chunk.type === "tool-call") {
          const c = chunk as any;
          const rawInput = c.input;
          const parsedInput: Record<string, unknown> =
            typeof rawInput === "string" ? JSON.parse(rawInput) : (rawInput ?? {});
          stepToolCalls.push({ toolCallId: c.toolCallId ?? "", toolName: c.toolName ?? "", input: parsedInput });
        } else if (chunk.type === "error") {
          throw (chunk as any).error;
        }
      }

      if (stepToolCalls.length === 0 || !onToolCall) break;

      const toolResultParts: any[] = [];
      for (const tc of stepToolCalls) {
        const toolCall: ToolCall = { id: tc.toolCallId, name: tc.toolName, arguments: tc.input, status: "running" };
        allToolCalls.push(toolCall);
        onToolCallStart?.(toolCall);

        try {
          const res = await onToolCall(toolCall);
          toolCall.status = "completed";
          toolCall.result = res;
          toolResultParts.push({
            type: "tool-result",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            output: { type: "text" as const, value: typeof res === "string" ? res : JSON.stringify(res) },
          });
        } catch (err: any) {
          toolCall.status = "error";
          toolCall.error = err.message || String(err);
          toolResultParts.push({
            type: "tool-result",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            output: { type: "error-text" as const, value: `Error: ${toolCall.error}` },
          });
        }
      }

      const assistantParts: any[] = [];
      if (stepContent) assistantParts.push({ type: "text", text: stepContent });
      for (const tc of stepToolCalls) {
        assistantParts.push({ type: "tool-call", toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: assistantParts },
        { role: "tool", content: toolResultParts },
      ];
    }

    return this.createAssistantMessage(
      fullContent,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    );
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
    if (this.useManualToolLoop) {
      return this.chatManualToolLoop(messages, systemPrompt, onToken, onToolCall, onToolCallStart, signal, tools);
    }

    const model = this.createModel();
    const resolvedSystem = this.resolveSystemPrompt(systemPrompt);
    const modelMessages = this.himeToModelMessages(messages);
    const allToolCalls: ToolCall[] = [];
    const vercelTools = this.buildVercelTools(tools, onToolCall, onToolCallStart, allToolCalls);
    const content = { value: "" };

    const result = streamText({
      model,
      system: resolvedSystem,
      messages: modelMessages,
      ...(vercelTools ? { tools: vercelTools } : {}),
      stopWhen: stepCountIs(10),
      maxOutputTokens: 16384,
      abortSignal: signal,
    });

    await this.consumeStream(result, signal, onToken, content);

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
      content.value,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      usage
    );
  }
}
