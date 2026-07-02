import { BaseProvider, type AIProvider, type ChatMessage, type StreamOptions } from "./index";
import { parseOpenAIStream } from "./openai";

export class DeepSeekProvider extends BaseProvider implements AIProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";

  private get apiKey() {
    return process.env.DEEPSEEK_API_KEY || "";
  }

  isHealthy(): boolean {
    if (!this.apiKey || this.apiKey.length < 10) return false;
    if (process.env.FORCE_PROVIDER_FAILURE === "deepseek") return false;
    return super.isHealthy();
  }

  async *streamChat(
    messages: ChatMessage[],
    options: StreamOptions = {}
  ): AsyncIterable<string> {
    const { systemPrompt = "", maxTokens = 4096, temperature = 0.7 } = options;

    const allMessages = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages,
    ];

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: allMessages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek ${res.status}: ${err.slice(0, 200)}`);
    }

    yield* parseOpenAIStream(res);
  }
}
