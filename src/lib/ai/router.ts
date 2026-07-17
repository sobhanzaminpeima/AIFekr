import fs from "fs";
import path from "path";
import { PROVIDERS, getAvailableProviders, streamProvider, type ChatMessage, type Provider, type TokenUsage } from "./providers";

const STALL_TIMEOUT_MS = 10_000; // 10s — applies to first token AND any gap between chunks

/**
 * Wraps streamProvider with a *rolling* inactivity timeout (resets on every
 * chunk) so a provider that goes silent mid-response — not just before the
 * first token — is caught and treated as a failure instead of hanging
 * forever. Chunks are forwarded to onChunk live for real-time streaming;
 * the thrown error carries a `partial` flag so the caller knows whether any
 * text was already shown before this provider failed.
 */
async function streamWithStallGuard(
  provider: Provider,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  maxTokensOverride?: number
): Promise<TokenUsage | null> {
  return new Promise<TokenUsage | null>((resolve, reject) => {
    let settled = false;
    let receivedAny = false;
    let timer: ReturnType<typeof setTimeout>;

    const fail = (e: Error) => {
      (e as Error & { partial?: boolean }).partial = receivedAny;
      reject(e);
    };

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        fail(
          new Error(
            receivedAny
              ? `Timeout: stream stalled for ${STALL_TIMEOUT_MS / 1000}s mid-response`
              : `Timeout: no token within ${STALL_TIMEOUT_MS / 1000}s`
          )
        );
      }, STALL_TIMEOUT_MS);
    };

    arm();
    streamProvider(provider, messages, systemPrompt, (text) => {
      if (settled) return; // already timed out — ignore late chunks
      receivedAny = true;
      onChunk(text);
      arm();
    }, maxTokensOverride)
      .then((usage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(usage);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fail(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

function getDisabledProviders(): Set<string> {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/lib/ai/provider-config.json"), "utf-8"));
    return new Set(cfg.disabled ?? []);
  } catch {
    return new Set();
  }
}

function getEnabledProviders(): Provider[] {
  const disabled = getDisabledProviders();
  return getAvailableProviders().filter((p) => !disabled.has(p.id));
}

// ─── Query type detection ────────────────────────────────────────────────────
type QueryType = "code" | "math" | "creative" | "translation" | "business" | "complex" | "fast" | "general";

const PATTERNS: Record<QueryType, RegExp> = {
  code: /\b(code|کد|python|javascript|typescript|java|sql|api|debug|function|class|error|bug|script|برنامه|الگوریتم|algorithm|html|css|react|next|git|bash|shell|deploy)\b/i,
  math: /\b(math|ریاضی|calculate|محاسبه|equation|معادله|integral|مشتق|matrix|ماتریس|probability|احتمال|statistics|آمار|formula|فرمول|\d+\s*[\+\-\*\/]\s*\d+)\b/i,
  creative: /\b(story|داستان|poem|شعر|creative|خلاق|write|بنویس|novel|رمان|song|آهنگ|lyrics|متن|script|فیلمنامه|imagine|تصور|design|طراح)\b/i,
  translation: /\b(translate|ترجمه|translation|ترجمه‌کن|به فارسی|به انگلیسی|to english|to persian|to arabic|به عربی)\b/i,
  business: /\b(business|کسب‌وکار|marketing|بازاریابی|strategy|استراتژی|startup|سرمایه|investment|finance|مالی|customer|مشتری|sales|فروش|brand|برند|plan|طرح)\b/i,
  complex: /\b(analyze|تحلیل|analysis|compare|مقایسه|research|تحقیق|explain|توضیح|philosophy|فلسفه|science|علم|detailed|جزئی|comprehensive|جامع)\b/i,
  fast: /\b(quick|سریع|brief|کوتاه|simple|ساده|yes|no|بله|خیر|what is|چیست|when|کی|who|کیست)\b/i,
  general: /.*/,
};

export function detectQueryType(message: string): QueryType {
  for (const [type, pattern] of Object.entries(PATTERNS) as [QueryType, RegExp][]) {
    if (type === "general") continue;
    if (pattern.test(message)) return type;
  }
  return "general";
}

// ─── Routing table: query type → provider priority list ─────────────────────
const ROUTING_TABLE: Record<QueryType, string[]> = {
  code:        ["claude", "deepseek-v3", "gpt5", "deepseek-direct"],
  math:        ["claude", "deepseek-v3", "deepseek-direct", "gpt5"],
  creative:    ["claude", "gpt5", "openrouter", "gemini"],
  translation: ["claude", "gemini", "openrouter", "gpt5", "deepseek-v3"],
  business:    ["claude", "gpt5", "openrouter", "gemini"],
  complex:     ["claude", "gpt5", "openrouter", "deepseek-v3"],
  fast:        ["gemini", "claude", "deepseek-direct", "deepseek-v3"],
  general:     ["claude", "gpt5", "gemini", "openrouter", "deepseek-v3", "deepseek-direct"],
};

// ─── Pick best available provider for a query ────────────────────────────────
export function selectProvider(message: string, userPreferredModel?: string): Provider {
  const available = getEnabledProviders();
  const availableIds = new Set(available.map((p) => p.id));

  // If user explicitly picked a specific claude model, respect it
  if (userPreferredModel && userPreferredModel !== "auto") {
    const byModel = available.find((p) => p.model === userPreferredModel);
    if (byModel) return byModel;
  }

  const queryType = detectQueryType(message);
  const priority = ROUTING_TABLE[queryType];

  for (const id of priority) {
    if (availableIds.has(id)) {
      const provider = available.find((p) => p.id === id)!;
      return provider;
    }
  }

  // Final fallback — anything enabled/available
  return available[0] ?? PROVIDERS[0];
}

// ─── Stream with automatic fallback ─────────────────────────────────────────
export async function routedStreamChat(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onProviderSelected: (provider: Provider) => void,
  userPreferredModel?: string,
  /**
   * Fired when a provider fails *after* already streaming some chunks via
   * onChunk, right before the next provider is tried with the same
   * messages. Callers must use this to discard any partial text already
   * shown to the user (reset their accumulator / tell the client to clear
   * the message bubble) — otherwise the next provider's full response gets
   * silently concatenated onto the previous provider's half-finished one.
   */
  onFallback?: (info: { from: Provider; partial: boolean }) => void,
  /** Override each provider's default max_tokens — use for long-form generation (e.g. full website HTML) that would otherwise get truncated. */
  maxTokensOverride?: number,
  /** Fired once with real prompt/completion token counts, when the provider that succeeded reports usage. Not every provider returns usage on every request (e.g. no output at all) — in that case this is never called and callers should treat tokens as unknown, not zero. */
  onUsage?: (usage: TokenUsage) => void
): Promise<Provider> {
  const message = messages[messages.length - 1]?.content ?? "";
  const primary = selectProvider(message, userPreferredModel);
  onProviderSelected(primary);

  // Try primary
  try {
    const usage = await streamWithStallGuard(primary, messages, systemPrompt, onChunk, maxTokensOverride);
    if (usage) onUsage?.(usage);
    return primary;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const partial = (error as Error & { partial?: boolean }).partial ?? false;
    console.warn(`[Router] ${primary.name} failed:`, error.message);
    onFallback?.({ from: primary, partial });
  }

  // Fallback chain — try all other enabled providers
  const available = getEnabledProviders().filter((p) => p.id !== primary.id);
  for (const fallback of available) {
    try {
      console.log(`[Router] Falling back to ${fallback.name}`);
      onProviderSelected(fallback);
      const usage = await streamWithStallGuard(fallback, messages, systemPrompt, onChunk, maxTokensOverride);
      if (usage) onUsage?.(usage);
      return fallback;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const partial = (error as Error & { partial?: boolean }).partial ?? false;
      console.warn(`[Router] ${fallback.name} also failed:`, error.message);
      onFallback?.({ from: fallback, partial });
    }
  }

  throw new Error("All AI providers failed");
}
