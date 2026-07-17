export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Some providers (Google, Groq, Cohere, OpenRouter) block requests from this
// server's IP at the network level (returns bare 403s even with no API key,
// on unrelated endpoints — not an auth/quota issue). RELAY_BASE_URL points
// at a small nginx reverse-proxy on a non-blocked VPS that forwards to the
// real provider hosts. Falls back to the real host directly if unset.
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";

export interface Provider {
  id: string;
  name: string;
  model: string;
  provider: string;
  baseURL: string;
  apiKey: string;
  strengths: string[];
  maxTokens: number;
  /**
   * Hard ceiling this provider/model/account can actually accept for
   * max_tokens — callers requesting long-form output (maxTokensOverride)
   * get clamped to this rather than erroring outright. Defaults to
   * `maxTokens` when unset. Free-tier models often reject (not just
   * truncate) requests above their real cap — e.g. Cohere's Command R7B
   * hard-errors above 4096, Groq enforces a tokens-per-minute budget.
   */
  maxOutputCeiling?: number;
  creditCost: number;
}

// ─── Provider registry ──────────────────────────────────────────────────────
export const PROVIDERS: Provider[] = [
  {
    id: "claude",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
    baseURL: "https://api.anthropic.com/v1",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    strengths: ["code", "reasoning", "creative", "general", "complex", "business"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 3,
  },
  {
    id: "gpt5",
    name: "GPT-5",
    provider: "openai",
    model: "gpt-5",
    baseURL: "https://models.inference.ai.azure.com",
    apiKey: process.env.GITHUB_TOKEN_GPT5 || "",
    strengths: ["code", "reasoning", "creative", "general", "complex"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 5,
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "deepseek",
    model: "DeepSeek-V3-0324",
    baseURL: "https://models.inference.ai.azure.com",
    apiKey: process.env.GITHUB_TOKEN_DEEPSEEK || "",
    strengths: ["code", "math", "reasoning", "technical"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 2,
  },
  {
    id: "deepseek-direct",
    name: "DeepSeek Chat (Direct)",
    provider: "deepseek",
    model: "deepseek-chat",
    baseURL: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    strengths: ["code", "math", "general"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 2,
  },
  {
    id: "openrouter",
    name: "OpenRouter (Gemini 2.5 Pro)",
    provider: "openrouter",
    model: "google/gemini-2.5-pro-preview",
    baseURL: RELAY_BASE_URL ? `${RELAY_BASE_URL}/openrouter/api/v1` : "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    strengths: ["creative", "general", "translation", "multimodal"],
    maxTokens: 3000,
    creditCost: 4,
  },
  {
    id: "gemini",
    name: "Gemini 2.0 Flash",
    provider: "google",
    model: "gemini-2.0-flash",
    baseURL: RELAY_BASE_URL ? `${RELAY_BASE_URL}/gemini/v1beta/openai` : "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: process.env.GEMINI_API_KEY || "",
    strengths: ["creative", "translation", "factual", "fast"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 1,
  },
  {
    // Free-tier last-resort fallback — only reached if every paid provider
    // above has failed. Groq's free tier has a much higher daily request
    // cap than other free options, but it's still a shared free pool, so
    // this must never be promoted above a paid provider in ROUTING_TABLE.
    id: "groq",
    name: "Groq (Llama 3.3 70B, free tier)",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    baseURL: RELAY_BASE_URL ? `${RELAY_BASE_URL}/groq/openai/v1` : "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY || "",
    strengths: ["general", "fast"],
    maxTokens: 4096,
    // Groq enforces a 12,000 tokens-per-minute budget shared across prompt
    // + completion (not a flat per-request cap) — 9000 leaves headroom for
    // the prompt itself while still being enough to finish a full page.
    maxOutputCeiling: 9000,
    creditCost: 1,
  },
  {
    // Second free-tier last-resort fallback, tried after Groq. Uses
    // Cohere's official OpenAI-compatibility endpoint (api.cohere.ai/
    // compatibility/v1), not its native /v2/chat schema.
    id: "cohere",
    name: "Cohere (Command R7B, free tier)",
    provider: "cohere",
    model: "command-r7b-12-2024",
    baseURL: RELAY_BASE_URL ? `${RELAY_BASE_URL}/cohere/compatibility/v1` : "https://api.cohere.ai/compatibility/v1",
    apiKey: process.env.COHERE_API_KEY || "",
    strengths: ["general", "fast"],
    maxTokens: 4096,
    creditCost: 1,
  },
];

export function getProviderById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getAvailableProviders(): Provider[] {
  return PROVIDERS.filter((p) => p.apiKey.length > 10);
}

// ─── OpenAI-compatible streaming (for non-Anthropic providers) ──────────────
export async function streamOpenAICompat(
  provider: Provider,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  maxTokensOverride?: number
): Promise<TokenUsage | null> {
  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: maxTokensOverride ? Math.min(maxTokensOverride, provider.maxOutputCeiling ?? provider.maxTokens) : provider.maxTokens,
    temperature: 0.7,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };

  // OpenRouter needs extra headers
  if (provider.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://aifekr.com";
    headers["X-Title"] = "AiFekr";
  }

  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.name} error ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage | null = null;

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
      if (data === "[DONE]") return usage;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? 0,
            totalTokens: parsed.usage.total_tokens ?? 0,
          };
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
  return usage;
}

// ─── Anthropic (native Messages API — not OpenAI-compatible) ────────────────
async function streamAnthropic(
  provider: Provider,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  maxTokensOverride?: number
): Promise<TokenUsage | null> {
  const res = await fetch(`${provider.baseURL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokensOverride ? Math.min(maxTokensOverride, provider.maxOutputCeiling ?? provider.maxTokens) : provider.maxTokens,
      temperature: 0.7,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.name} error ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

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

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          onChunk(parsed.delta.text);
        } else if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) {
          inputTokens = parsed.message.usage.input_tokens;
        } else if (parsed.type === "message_delta" && parsed.usage?.output_tokens) {
          outputTokens = parsed.usage.output_tokens;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  if (!inputTokens && !outputTokens) return null;
  return { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens };
}

// ─── Unified stream entry point ──────────────────────────────────────────────
export async function streamProvider(
  provider: Provider,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  maxTokensOverride?: number
): Promise<TokenUsage | null> {
  if (provider.provider === "anthropic") {
    return streamAnthropic(provider, messages, systemPrompt, onChunk, maxTokensOverride);
  }
  return streamOpenAICompat(provider, messages, systemPrompt, onChunk, maxTokensOverride);
}
