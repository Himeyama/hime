import * as crypto from "crypto";
import {
  GoogleGenAI,
  Content,
  Part,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
} from "@google/genai";
import { BaseProvider } from "./base";
import { SystemPrompt } from "../types/provider";
import { Message, ProviderType, ToolCall, TokenUsage } from "../types/chat";

// 認証方法:
//   Gemini Developer API: apiKey に Google AI Studio のキーを設定
//   Vertex AI (ADC):      endpoint にプロジェクト ID、deploymentName にリージョンを設定
//                         gcloud auth application-default login で ADC を設定しておく

export class GoogleProvider extends BaseProvider {
  readonly type: ProviderType = "google";
  readonly displayName = "Google Gemini";

  private createClient(): GoogleGenAI {
    if (this.config.apiKey) {
      return new GoogleGenAI({ apiKey: this.config.apiKey });
    }
    return new GoogleGenAI({
      vertexai: true,
      project: this.config.endpoint || "",
      location: this.config.deploymentName || "us-central1",
    });
  }

  private convertMessages(messages: Message[]): Content[] {
    const contents: Content[] = [];

    for (const m of messages) {
      if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      } else if (m.role === "assistant") {
        const parts: Part[] = [];
        if (m.content) parts.push({ text: m.content });

        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            parts.push(createPartFromFunctionCall(tc.name, tc.arguments));
          }
        }

        if (parts.length > 0) {
          contents.push({ role: "model", parts });
        }

        if (m.toolCalls && m.toolCalls.length > 0) {
          const resultParts: Part[] = m.toolCalls.map((tc) =>
            createPartFromFunctionResponse(tc.id, tc.name, {
              result: tc.result || tc.error || "",
            })
          );
          contents.push({ role: "user", parts: resultParts });
        }
      }
    }

    return contents;
  }

  // Gemini API が認識しない JSON Schema フィールドを再帰的に除去する
  private sanitizeSchema(schema: any): any {
    if (Array.isArray(schema)) {
      return schema.map((item) => this.sanitizeSchema(item));
    }
    if (schema === null || typeof schema !== "object") {
      return schema;
    }

    const unsupported = new Set([
      "exclusiveMaximum",
      "exclusiveMinimum",
      "additionalProperties",
      "$schema",
      "$defs",
      "definitions",
      "const",
      "if",
      "then",
      "else",
      "not",
      "contentEncoding",
      "contentMediaType",
    ]);

    const result: any = {};
    for (const [k, v] of Object.entries(schema)) {
      if (unsupported.has(k)) continue;
      result[k] = this.sanitizeSchema(v);
    }
    return result;
  }

  private convertTools(tools: any[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description || "",
          parameters: this.sanitizeSchema(t.function.parameters),
        })),
      },
    ];
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
    const resolvedSystemPrompt = this.resolveSystemPrompt(systemPrompt);
    const client = this.createClient();
    let currentContents = this.convertMessages(messages);
    const genaiTools = this.convertTools(tools || []);

    let fullContent = "";
    const allToolCalls: ToolCall[] = [];
    let iteration = 0;
    const maxIterations = 10;
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

    while (iteration < maxIterations) {
      iteration++;
      let currentIterationContent = "";
      const currentIterationToolCalls: ToolCall[] = [];
      const seenIds = new Set<string>();

      const stream = await client.models.generateContentStream({
        model: this.config.model,
        contents: currentContents,
        config: {
          systemInstruction: resolvedSystemPrompt,
          ...(genaiTools ? { tools: genaiTools } : {}),
        },
      });

      let lastUsageMetadata: any = null;
      for await (const chunk of stream) {
        if (signal?.aborted) break;

        if (chunk.usageMetadata) {
          lastUsageMetadata = chunk.usageMetadata;
        }

        if (chunk.text) {
          currentIterationContent += chunk.text;
          fullContent += chunk.text;
          onToken(chunk.text);
        }

        if (chunk.functionCalls) {
          for (const fc of chunk.functionCalls) {
            const id = fc.id || crypto.randomUUID();
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            const toolCall: ToolCall = {
              id,
              name: fc.name || "",
              arguments: fc.args || {},
              status: "running",
            };
            currentIterationToolCalls.push(toolCall);
            
            // Notify start of tool call immediately
            if (onToolCallStart) {
              onToolCallStart(toolCall);
            }
          }
        }
      }

      if (lastUsageMetadata) {
        totalUsage.inputTokens += lastUsageMetadata.promptTokenCount ?? 0;
        totalUsage.outputTokens += lastUsageMetadata.candidatesTokenCount ?? 0;
        totalUsage.cacheReadTokens = (totalUsage.cacheReadTokens ?? 0) + (lastUsageMetadata.cachedContentTokenCount ?? 0);
      }

      allToolCalls.push(...currentIterationToolCalls);

      if (currentIterationToolCalls.length === 0) break;

      // モデルのターンにファンクションコールを追加
      const modelParts: Part[] = [];
      if (currentIterationContent) modelParts.push({ text: currentIterationContent });
      for (const tc of currentIterationToolCalls) {
        modelParts.push(createPartFromFunctionCall(tc.name, tc.arguments));
      }
      currentContents.push({ role: "model", parts: modelParts });

      // ツールを実行して結果を追加
      const resultParts: Part[] = [];
      for (const tc of currentIterationToolCalls) {
        if (onToolCall) {
          try {
            const result = await onToolCall(tc);
            tc.status = "completed";
            tc.result = result;
            resultParts.push(
              createPartFromFunctionResponse(tc.id, tc.name, { result })
            );
          } catch (err: any) {
            tc.status = "error";
            tc.error = err.message || String(err);
            resultParts.push(
              createPartFromFunctionResponse(tc.id, tc.name, { error: tc.error })
            );
          }
        }
      }
      if (resultParts.length > 0) {
        currentContents.push({ role: "user", parts: resultParts });
      }
    }

    return this.createAssistantMessage(
      fullContent,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      totalUsage
    );
  }

  async listModels(): Promise<string[]> {
    return [
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-thinking-exp-01-21",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.0-pro",
    ];
  }

  async testConnection(): Promise<boolean> {
    const client = this.createClient();
    await client.models.generateContent({
      model: this.config.model,
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    return true;
  }
}
