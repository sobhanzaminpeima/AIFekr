import { BaseProvider, type AIProvider, type ChatMessage, type StreamOptions } from "./index";

export class OpenAIProvider extends BaseProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI GPT";

  private get apiKey() {
    return process.env.OPENAI_API_KEY || "";
  }

  isHealthy(): boolean {
    if (!this.apiKey || this.apiKey.length < 10) return false;
    if (process.env.FORCE_PROVIDER_FAILURE === "openai") return false;
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

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: allMessages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }

    yield* parseOpenAIStream(res);
  }
}

/** Reusable SSE parser for any OpenAI-compatible endpoint */
export async function* parseOpenAIStream(res: Response): AsyncIterable<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
