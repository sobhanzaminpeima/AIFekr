import { fallbackReason } from "./fallbackReason";
import { getDisabledProviders, refreshDisabledProviders } from "./providerConfig";
import { PROVIDERS, getAvailableProviders, streamProvider, type ChatMessage, type Provider, type TokenUsage } from "./providers";
import { getDynamicProviders, refreshDynamicProviders } from "./llmProviders/registry";
import { llmContext } from "./llmProviders/context";

const FIRST_TOKEN_TIMEOUT_MS = 8_000;
const STREAM_GAP_TIMEOUT_MS = 30_000;

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
    const abort = new AbortController();
    // The caller's cancel (user closed the chat) stops the upstream request too.
    const outer = llmContext().signal;
    if (outer) {
      if (outer.aborted) abort.abort(outer.reason);
      else outer.addEventListener("abort", () => abort.abort(outer.reason), { once: true });
    }

    const fail = (e: Error) => {
      (e as Error & { partial?: boolean }).partial = receivedAny;
      reject(e);
    };

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        abort.abort(new Error("STALL_TIMEOUT"));
        fail(
          new Error(
            receivedAny
              ? `Timeout: stream stalled for ${STREAM_GAP_TIMEOUT_MS / 1000}s mid-response`
              : `Timeout: no token within ${(provider.firstTokenTimeoutMs ?? FIRST_TOKEN_TIMEOUT_MS) / 1000}s`
          )
        );
      }, receivedAny ? STREAM_GAP_TIMEOUT_MS : provider.firstTokenTimeoutMs ?? FIRST_TOKEN_TIMEOUT_MS);
    };

    arm();
    streamProvider(provider, messages, systemPrompt, (text) => {
      if (settled) return; // already timed out — ignore late chunks
      receivedAny = true;
      onChunk(text);
      arm();
    }, maxTokensOverride, abort.signal)
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A transient RPM/TPM limit can clear in seconds. A provider's exhausted
 * account quota, missing billing, or disabled API is permanent until an
 * operator changes it; retrying it three times makes every affected chat wait
 * 90 seconds before the normal fallback chain can help. Gemini reports both
 * conditions as HTTP 429, so status code alone is not enough.
 */
function isRetryableRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  if (!(/error 429/.test(message) || /rate limit/.test(message) || /resource_exhausted/.test(message))) return false;
  return !/(exceeded your current quota|check your plan and billing|billing details|insufficient quota|quota.*exceeded)/.test(message);
}

/**
 * Failures that will repeat on every request until an operator acts:
 * exhausted quota/billing, a rejected key, or a request the provider refuses
 * as invalid for this model. Gemini's exhausted quota made every chat try it
 * first and wait for the error (1,121 times in production) before falling
 * back. Transient 429s, timeouts and 5xx are not included.
 */
export function isPersistentProviderError(error: Error): boolean {
  const message = error.message.toLowerCase();
  if (/(exceeded your current quota|check your plan and billing|billing details|insufficient quota|insufficient_quota|quota.*exceeded)/.test(message)) return true;
  if (/error (401|403)\b/.test(message)) return true;
  return /error 400\b/.test(message) && /(unsupported (value|parameter)|model.*(not found|does not exist|not supported))/.test(message);
}

const COOLDOWN_MS = 10 * 60_000;
const coolingUntil = new Map<string, number>();
/** Skip a provider for a while after a persistent failure; it is tried again automatically afterwards. */
function coolDown(provider: Provider, error: Error) {
  if (!isPersistentProviderError(error)) return;
  coolingUntil.set(provider.id, Date.now() + COOLDOWN_MS);
  console.warn(`[Router] ${provider.name} paused for ${COOLDOWN_MS / 60_000} min after a persistent error`);
}
const isCooling = (p: Provider) => (coolingUntil.get(p.id) ?? 0) > Date.now();
/** Enabled providers minus those cooling down; if every one is cooling, all of them (never leave chat with nothing). */
function usableProviders(): Provider[] {
  // Dynamic models (Coarena) join automatic routing only as the admin's chosen last resort.
  const enabled = [...getEnabledProviders(), ...getDynamicProviders().filter((p) => p.dynamic?.fallbackEligible)], ready = enabled.filter(p => !isCooling(p));
  return ready.length ? ready : enabled;
}

/**
 * Everything a user may pick by name: enabled static providers plus every
 * enabled, available model of an enabled dynamic provider. A disabled or
 * unlisted model is simply not here, so naming it cannot reach it.
 */
export function getChatProviders(): Provider[] {
  return [...getEnabledProviders(), ...getDynamicProviders()];
}

/** The provider a user's explicit `model` string names, or undefined (auto / unknown / disabled). */
export function findChatProvider(model: unknown): Provider | undefined {
  if (typeof model !== "string" || !model || model === "auto") return undefined;
  return getChatProviders().find((p) => p.model === model);
}

/** True for model strings that name a dynamic provider's model ("coarena:<id>"). */
export function isDynamicModelString(model: unknown): model is string {
  return typeof model === "string" && !model.startsWith("custom:") && /^[a-z][a-z0-9-]{1,30}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model);
}

/**
 * Exported (not just used internally) so callers that need a *restricted*
 * subset of providers -- e.g. the floating support assistant, which must
 * only ever pick from free-tier providers and never fall through to a paid
 * one -- can filter this same admin-configured enabled/disabled list rather
 * than re-implementing it (see providerConfig.ts).
 */
export function getEnabledProviders(): Provider[] {
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
  if (/^(سلام|درود|hi|hello|hey|hallo|merhaba)[!.،\s]*$/i.test(message.trim())) return "fast";
  for (const [type, pattern] of Object.entries(PATTERNS) as [QueryType, RegExp][]) {
    if (type === "general") continue;
    if (pattern.test(message)) return type;
  }
  return "general";
}

// ─── Routing table: query type → provider priority list ─────────────────────
export const ROUTING_TABLE: Record<QueryType, string[]> = {
  code:        ["claude", "deepseek-v3", "gpt5", "deepseek-direct", "groq", "cohere"],
  math:        ["claude", "deepseek-v3", "deepseek-direct", "gpt5", "groq", "cohere"],
  creative:    ["claude", "gpt5", "openrouter", "gemini", "groq", "cohere"],
  translation: ["claude", "gemini", "openrouter", "gpt5", "deepseek-v3", "groq", "cohere"],
  business:    ["claude", "gpt5", "openrouter", "gemini", "groq", "cohere"],
  complex:     ["claude", "gpt5", "openrouter", "deepseek-v3", "groq", "cohere"],
  fast:        ["groq", "gemini", "claude", "deepseek-direct", "deepseek-v3", "cohere"],
  general:     ["claude", "gpt5", "gemini", "openrouter", "deepseek-v3", "deepseek-direct", "groq", "cohere"],
};

// ─── Pick best available provider for a query ────────────────────────────────
export function selectProvider(message: string, userPreferredModel?: string): Provider {
  const available = usableProviders();
  const availableIds = new Set(available.map((p) => p.id));

  // If user explicitly picked a specific claude model, respect it
  if (userPreferredModel && userPreferredModel !== "auto") {
    const byModel = available.find((p) => p.model === userPreferredModel) ?? getDynamicProviders().find((p) => p.model === userPreferredModel);
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
  onFallback?: (info: { from: Provider; partial: boolean; reason: string }) => void,
  /** Override each provider's default max_tokens — use for long-form generation (e.g. full website HTML) that would otherwise get truncated. */
  maxTokensOverride?: number,
  /** Fired once with real prompt/completion token counts, when the provider that succeeded reports usage. Not every provider returns usage on every request (e.g. no output at all) — in that case this is never called and callers should treat tokens as unknown, not zero. */
  onUsage?: (usage: TokenUsage) => void
): Promise<Provider> {
  await Promise.all([refreshDisabledProviders(), refreshDynamicProviders()]);
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
    // The user went away: stop here, do not spend a fallback provider on nobody.
    if (llmContext().signal?.aborted) throw error;
    console.warn(`[Router] ${primary.name} failed:`, error.message);
    coolDown(primary, error);
    const reason = fallbackReason(error);
    // A dynamic model the user picked falls back only when the admin allowed it;
    // otherwise its safe, typed error goes to the caller.
    if (primary.dynamic && !primary.dynamic.fallbackOnError) throw error;
    recordFallback(primary, usableProviders().find((p) => p.id !== primary.id) ?? null, reason, message);
    onFallback?.({ from: primary, partial, reason });

    // Prefer an available fallback immediately; only a sole provider gets
    // one short retry, so a rate limit does not add a 90-second wait.
    if (isRetryableRateLimitError(error) && getEnabledProviders().every(p => p.id === primary.id)) {
      const retryDelaysMs = [1_000];
      for (const delay of retryDelaysMs) {
        await sleep(delay);
        try {
          console.log(`[Router] Retrying ${primary.name} after ${delay / 1000}s rate-limit wait`);
          const usage = await streamWithStallGuard(primary, messages, systemPrompt, onChunk, maxTokensOverride);
          if (usage) onUsage?.(usage);
          return primary;
        } catch (retryErr) {
          const retryError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
          const retryPartial = (retryError as Error & { partial?: boolean }).partial ?? false;
          console.warn(`[Router] ${primary.name} retry also failed:`, retryError.message);
          onFallback?.({ from: primary, partial: retryPartial, reason: fallbackReason(retryError) });
          if (!isRetryableRateLimitError(retryError)) break; // non-retryable failure — move to fallback chain
        }
      }
    }
  }

  // Fallback chain — try all other enabled providers
  const available = usableProviders().filter((p) => p.id !== primary.id);
  for (const fallback of available) {
    if (llmContext().signal?.aborted) break;
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
      coolDown(fallback, error);
      const reason = fallbackReason(error);
      const next = available[available.indexOf(fallback) + 1] ?? null;
      recordFallback(fallback, next, reason, message);
      onFallback?.({ from: fallback, partial, reason });
    }
  }

  throw new Error("All AI providers failed");
}


/**
 * One row per failed provider in ProviderFallbackLog, which the admin fallback
 * page reads; nothing wrote it before, so the page was always empty and the
 * real upstream error lived only in pm2 stdout. Fire-and-forget: a logging
 * failure must never affect the answer.
 */
function recordFallback(from: Provider, to: Provider | null, reason: string, prompt: string) {
  void import("@/lib/db/prisma")
    .then(({ prisma }) => prisma.providerFallbackLog.create({ data: { fromProvider: from.id, toProvider: to?.id ?? null, reason, category: detectQueryType(prompt) } }))
    .catch(() => {});
}
