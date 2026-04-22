import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { VercelBaseProvider } from "./vercel-base";
import type { ProviderType } from "../types/chat";

// Vertex AI (ADC) は @ai-sdk/google-vertex が必要 (未対応)。
// apiKey を設定した Gemini Developer API を使用してください。

export class GoogleProvider extends VercelBaseProvider {
  readonly type: ProviderType = "google";
  readonly displayName = "Google Gemini";

  protected createModel(): LanguageModel {
    if (!this.config.apiKey) {
      throw new Error(
        "Google プロバイダーには API キーが必要です。" +
        "Vertex AI を使用する場合は @ai-sdk/google-vertex のインストールが別途必要です。"
      );
    }
    return createGoogleGenerativeAI({ apiKey: this.config.apiKey })(this.config.model);
  }

  async listModels(): Promise<string[]> {
    return [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ];
  }

  async testConnection(): Promise<boolean> {
    await generateText({
      model: this.createModel(),
      prompt: "hi",
      maxOutputTokens: 1,
    });
    return true;
  }
}
