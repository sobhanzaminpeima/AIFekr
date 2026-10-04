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

// ─── FreeLLMAPI (self-hosted free-tier aggregator) ──────────────────────────
// Self-hosted at http://127.0.0.1:3001 (Docker, localhost-only — never
// exposed publicly) — aggregates free tiers from provider accounts the admin
// has added keys for, behind one OpenAI-compatible endpoint.
// https://github.com/tashfeenahmed/freellmapi
//
// IMPORTANT — only Mistral-family models are actually usable on this server
// right now, despite Google/Groq/Cerebras keys also being configured:
//   - Google (Gemini) is blocked at the network level from this VPS's IP
//     (same known issue as the `gemini` provider above — bare 403s).
//   - Groq/Cerebras models aren't unlocked on the free "monthly" catalog
//     snapshot tier this install is on (paid $19/yr unlocks same-day access
//     to new models) — they fail with "no usable key configured" even
//     though a healthy key exists for the platform.
// Re-verify with a real request (not just /v1/models' `available` flag,
// which lies for both cases above) before adding any non-Mistral model here.
const FREELLMAPI_BASE_URL = process.env.FREELLMAPI_BASE_URL || "http://127.0.0.1:3001/v1";
const FREELLMAPI_API_KEY = process.env.FREELLMAPI_API_KEY || "";

function freeModel(id: string, name: string, model: string, strengths: string[]): Provider {
  return {
    id,
    name,
    provider: "freellmapi",
    model,
    baseURL: FREELLMAPI_BASE_URL,
    apiKey: FREELLMAPI_API_KEY,
    strengths,
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 1,
  };
}

// All 13 confirmed working with a real request as of 2026-08-28 — see
// testall.sh results referenced in the deploy commit for this block.
const FREELLMAPI_PROVIDERS: Provider[] = [
  freeModel("free-mistral-large-3", "Mistral Large 3", "mistral-large-3", ["general", "business", "reasoning", "complex"]),
  freeModel("free-mistral-medium-3-5", "Mistral Medium 3.5", "mistral-medium-3.5", ["general", "business", "reasoning"]),
  freeModel("free-mistral-small-4", "Mistral Small 4", "mistral-small-4", ["general", "fast"]),
  freeModel("free-magistral-medium", "Magistral Medium", "magistral-medium", ["reasoning", "math", "complex"]),
  freeModel("free-magistral-small", "Magistral Small", "magistral-small", ["reasoning", "math"]),
  freeModel("free-ministral-14b", "Ministral 14B", "ministral-14b", ["general", "fast"]),
  freeModel("free-ministral-3-8b", "Ministral 3 8B", "ministral-3-8b", ["general", "fast"]),
  freeModel("free-codestral", "Codestral", "codestral", ["code", "technical"]),
  freeModel("free-devstral", "Devstral", "devstral", ["code", "technical"]),
  freeModel("free-devstral-medium", "Devstral Medium", "devstral-medium", ["code", "technical"]),
  freeModel("free-mistral-code", "Mistral Code", "mistral-code", ["code", "technical"]),
  freeModel("free-mistral-code-agent", "Mistral Code Agent", "mistral-code-agent", ["code", "technical"]),
  freeModel("free-mistral-vibe-cli", "Mistral Vibe CLI Fast", "mistral-vibe-cli-fast", ["code", "fast"]),
];

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
    id: "openai-direct",
    name: "OpenAI GPT (Direct)",
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    strengths: ["business", "creative", "general", "multimodal"],
    maxTokens: 4096,
    maxOutputCeiling: 8192,
    creditCost: 4,
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
    name: "Gemini 3.5 Flash",
    provider: "google",
    model: "gemini-3.5-flash",
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
    //
    // Was "llama-3.3-70b-versatile" — Groq retired the entire Llama-3.x
    // family from this account's catalog at some point (found 2026-09-11,
    // while building the floating support assistant: every real request
    // came back "404 model_not_found", meaning this fallback had been
    // silently dead — routedStreamChat just moved on to the next provider
    // in the chain, so nothing user-facing ever surfaced the failure).
    // Verified against Groq's live /v1/models: the current free catalog is
    // openai/gpt-oss-{20b,120b,safeguard-20b}, qwen/qwen3.{6,8}-27b,
    // groq/compound{,-mini}, allam-2-7b — gpt-oss-20b is the closest match
    // to the old model's "fast, general, last-resort" role.
    id: "groq",
    name: "Groq (GPT-OSS 20B, free tier)",
    provider: "groq",
    model: "openai/gpt-oss-20b",
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
  ...FREELLMAPI_PROVIDERS,
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
  maxTokensOverride?: number,
  signal?: AbortSignal
): Promise<TokenUsage | null> {
  const tokenCap = maxTokensOverride ? Math.min(maxTokensOverride, provider.maxOutputCeiling ?? provider.maxTokens) : provider.maxTokens;

  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    stream_options: { include_usage: true },
    // OpenAI's own API renamed this parameter and now hard-rejects the old
    // name: "Unsupported parameter: 'max_tokens' is not supported with this
    // model. Use 'max_completion_tokens' instead" — a 400 on every single
    // request, which made this provider a silently dead link in the fallback
    // chain (found 2026-09-12 in the dev server logs while testing the
    // orchestrator; same failure mode as the retired Groq model found in
    // Phase 3). Scoped to `provider: "openai"` because every other
    // OpenAI-*compatible* provider here — Groq, Mistral/FreeLLMAPI,
    // DeepSeek, OpenRouter, Cohere — still expects `max_tokens` and would
    // itself 400 on the new name.
    ...(provider.provider === "openai" ? { max_completion_tokens: tokenCap } : { max_tokens: tokenCap }),
    temperature: 0.7,
    // Groq's current free catalog is now exclusively "reasoning" models
    // (openai/gpt-oss-*, qwen3.x) -- unlike the plain instruct model this
    // provider used to point at, they spend part of the completion token
    // budget on an internal reasoning pass (delivered as `delta.reasoning`,
    // a field this function already ignores -- only `delta.content` below is
    // read) before writing the visible answer. Left at the model's default
    // effort, a longer prompt can burn the whole max_tokens budget on
    // reasoning and return no visible text at all (measured: with
    // max_tokens=100 and no override, "low" used 5 reasoning tokens and left
    // the rest for the answer). Scoped to Groq specifically since that's the
    // one measured -- other providers may not recognise this field at all.
    ...(provider.provider === "groq" ? { reasoning_effort: "low" } : {}),
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
    signal,
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
  maxTokensOverride?: number,
  signal?: AbortSignal
): Promise<TokenUsage | null> {
  const res = await fetch(`${provider.baseURL}/messages`, {
    method: "POST",
    signal,
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
  maxTokensOverride?: number,
  signal?: AbortSignal
): Promise<TokenUsage | null> {
  if (provider.provider === "anthropic") {
    return streamAnthropic(provider, messages, systemPrompt, onChunk, maxTokensOverride, signal);
  }
  return streamOpenAICompat(provider, messages, systemPrompt, onChunk, maxTokensOverride, signal);
}
