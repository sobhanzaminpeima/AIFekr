import { BaseProvider, type AIProvider, type ChatMessage, type StreamOptions } from "./index";
import { parseOpenAIStream } from "./openai";

export class GeminiProvider extends BaseProvider implements AIProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private get apiKey() {
    return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
  }

  isHealthy(): boolean {
    if (!this.apiKey || this.apiKey.length < 10) return false;
    if (process.env.FORCE_PROVIDER_FAILURE === "gemini") return false;
    return super.isHealthy();
  }

  async *streamChat(
    messages: ChatMessage[],
    options: StreamOptions = {}
  ): AsyncIterable<string> {
    const { systemPrompt = "", maxTokens = 4096, temperature = 0.7 } = options;

    // Gemini exposes an OpenAI-compatible endpoint
    const allMessages = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages,
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
          messages: allMessages,
          stream: true,
          max_tokens: maxTokens,
          temperature,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    yield* parseOpenAIStream(res);
  }
}
