import { BaseProvider, type AIProvider, type ChatMessage, type StreamOptions } from "./index";

export class ClaudeProvider extends BaseProvider implements AIProvider {
  readonly id = "claude";
  readonly name = "Anthropic Claude";

  private get apiKey() {
    return process.env.ANTHROPIC_API_KEY || "";
  }

  isHealthy(): boolean {
    if (!this.apiKey || this.apiKey.length < 10) return false;
    if (process.env.FORCE_PROVIDER_FAILURE === "claude") return false;
    return super.isHealthy();
  }

  async *streamChat(
    messages: ChatMessage[],
    options: StreamOptions = {}
  ): AsyncIterable<string> {
    const { systemPrompt = "", maxTokens = 4096, temperature = 0.7 } = options;

    const body: Record<string, unknown> = {
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature,
      messages: messages.filter((m) => m.role !== "system"),
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude ${res.status}: ${err.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from Claude");

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
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              const text = parsed.delta?.text;
              if (text) yield text;
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
