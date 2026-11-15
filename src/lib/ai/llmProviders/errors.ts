/**
 * Standard errors for dynamic LLM providers. Messages are fixed, safe strings:
 * an upstream body or header never reaches a user, a log line or the admin
 * page. The message keeps the router's "<name> error <status>" shape, so
 * router.ts's existing cooldown and fallback rules (isPersistentProviderError,
 * fallbackReason) keep working without knowing about this class.
 */
export type LlmErrorCategory =
  | "AUTH" | "FORBIDDEN" | "NOT_FOUND" | "TIMEOUT" | "RATE_LIMIT" | "QUOTA"
  | "UPSTREAM" | "BAD_RESPONSE" | "NETWORK" | "CANCELLED" | "INVALID" | "LIMIT" | "NOT_CONFIGURED";

const SAFE_TEXT: Record<LlmErrorCategory, string> = {
  AUTH: "authentication failed",
  FORBIDDEN: "access denied for this account",
  NOT_FOUND: "model not found",
  TIMEOUT: "request timed out",
  RATE_LIMIT: "rate limit exceeded",
  QUOTA: "insufficient quota",
  UPSTREAM: "provider unavailable",
  BAD_RESPONSE: "unexpected response from provider",
  NETWORK: "network error",
  CANCELLED: "request cancelled",
  INVALID: "request rejected as invalid",
  LIMIT: "internal usage limit reached",
  NOT_CONFIGURED: "provider is not configured",
};

/** Persian text for end users; never includes provider detail. */
export const USER_MESSAGE_FA: Record<LlmErrorCategory, string> = {
  AUTH: "اتصال به سرویس مدل برقرار نشد. لطفاً بعداً دوباره تلاش کنید.",
  FORBIDDEN: "این مدل فعلاً در دسترس نیست. مدل دیگری انتخاب کنید.",
  NOT_FOUND: "این مدل دیگر در دسترس نیست. مدل دیگری انتخاب کنید.",
  TIMEOUT: "پاسخ مدل بیش از حد طول کشید. دوباره تلاش کنید.",
  RATE_LIMIT: "درخواست‌ها به این مدل زیاد شده است. چند لحظه بعد دوباره تلاش کنید.",
  QUOTA: "اعتبار سرویس این مدل برای امروز تمام شده است. مدل دیگری انتخاب کنید یا بعداً تلاش کنید.",
  UPSTREAM: "سرویس این مدل موقتاً در دسترس نیست. دوباره تلاش کنید.",
  BAD_RESPONSE: "پاسخ نامعتبری از سرویس مدل دریافت شد. دوباره تلاش کنید.",
  NETWORK: "ارتباط با سرویس مدل قطع شد. دوباره تلاش کنید.",
  CANCELLED: "درخواست لغو شد.",
  INVALID: "این درخواست برای این مدل پذیرفته نشد.",
  LIMIT: "سقف استفادهٔ امروز از این مدل پر شده است. مدل دیگری انتخاب کنید یا فردا تلاش کنید.",
  NOT_CONFIGURED: "این مدل هنوز راه‌اندازی نشده است.",
};

export class LlmProviderError extends Error {
  readonly category: LlmErrorCategory;
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  /** Provider's stable error code (e.g. "insufficient_quota"); a short identifier, not text. */
  readonly upstreamCode: string | null;
  readonly upstreamRequestId: string | null;
  constructor(providerName: string, category: LlmErrorCategory, opts: { status?: number | null; retryAfterMs?: number | null; upstreamCode?: string | null; upstreamRequestId?: string | null } = {}) {
    const status = opts.status ?? null;
    super(`${providerName} error ${status ?? category.toLowerCase()}: ${SAFE_TEXT[category]}`);
    this.name = "LlmProviderError";
    this.category = category;
    this.status = status;
    this.retryAfterMs = opts.retryAfterMs ?? null;
    this.upstreamCode = opts.upstreamCode && /^[a-z0-9_.-]{1,64}$/i.test(opts.upstreamCode) ? opts.upstreamCode : null;
    this.upstreamRequestId = safeRequestId(opts.upstreamRequestId);
  }
  /** Temporary failures worth one more try before giving up on this provider. */
  get retryable(): boolean {
    return this.category === "TIMEOUT" || this.category === "RATE_LIMIT" || this.category === "UPSTREAM" || this.category === "NETWORK";
  }
}

export function safeRequestId(value: string | null | undefined): string | null {
  return value && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : null;
}

/** Retry-After as milliseconds: seconds or an HTTP date; null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * Maps an HTTP status (and the provider's stable error code, when it sent one)
 * to a category. Coarena reports daily-credit exhaustion as 429
 * insufficient_quota and per-minute limits as 429 rate_limit_exceeded; only the
 * first is permanent for the day.
 */
export function categorize(status: number, code: string | null): LlmErrorCategory {
  if (status === 401) return "AUTH";
  if (status === 402) return "QUOTA";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return code === "insufficient_quota" || code === "quota_unavailable" ? "QUOTA" : "RATE_LIMIT";
  if (status === 503 && code === "quota_unavailable") return "QUOTA";
  if (status >= 500) return "UPSTREAM";
  if (status === 400 || status === 413 || status === 422) return code === "model_not_found" || code === "model_off" ? "NOT_FOUND" : "INVALID";
  return "BAD_RESPONSE";
}

export interface RetryPolicy { attempts: number; baseMs: number; maxDelayMs: number }
export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, baseMs: 400, maxDelayMs: 4000 };

/**
 * Delay before retry number `attempt` (1-based): Retry-After when the provider
 * sent one, else exponential backoff with full jitter. Null means "do not retry"
 * (the provider asked for a wait longer than this request can afford, so the
 * router's fallback is the better answer).
 */
export function retryDelay(attempt: number, error: LlmProviderError, policy: RetryPolicy = DEFAULT_RETRY, random: () => number = Math.random): number | null {
  if (!error.retryable || attempt >= policy.attempts) return null;
  if (error.retryAfterMs !== null) return error.retryAfterMs <= policy.maxDelayMs ? error.retryAfterMs : null;
  const ceiling = Math.min(policy.maxDelayMs, policy.baseMs * 2 ** (attempt - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

/** Removes anything that looks like a credential from text bound for a log or the admin page. */
export function redactSecrets(text: string, secrets: (string | null | undefined)[] = []): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  return out
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]")
    .replace(/\b(sk|ck|key|coa)[-_][A-Za-z0-9_-]{12,}\b/gi, "[redacted]");
}
