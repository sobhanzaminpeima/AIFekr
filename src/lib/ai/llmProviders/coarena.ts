/**
 * Coarena Model API adapter (OpenAI-compatible, https://coarena.ai/api/v1).
 *
 * Endpoints used: GET /models, POST /chat/completions (stream and not),
 * POST /responses, GET /limits, GET /usage, GET /requests, GET /requests/{id}.
 * Response shapes follow Coarena's published OpenAPI (/api/openapi.json,
 * checked 2026-11-14); parsing is defensive (normalize.ts).
 *
 * The key is passed in by the caller (registry.ts reads it from the server
 * environment or the encrypted vault) and only ever goes into the
 * Authorization header. Errors carry fixed text plus Coarena's short error
 * code, never the response body.
 */
import { LlmProviderError, categorize, parseRetryAfter, retryDelay, safeRequestId, DEFAULT_RETRY, type RetryPolicy } from "./errors";
import { errorCode, normalizeLimits, normalizeModels, normalizeRequests, normalizeUsage, normalizeUsageReport, type NormalizedUsage } from "./normalize";

export const COARENA_DEFAULT_BASE_URL = "https://coarena.ai/api/v1";
const NAME = "Coarena";
const MAX_ERROR_BODY = 64 * 1024;
const MAX_JSON_BODY = 8 * 1024 * 1024;

export interface AdapterConfig {
  baseUrl: string;
  apiKey: string;
  /** Total time for a non-streaming call; time to response headers for a stream. */
  timeoutMs: number;
  retry?: RetryPolicy;
  fetchImpl?: typeof fetch;
  /** Test hook: replaces the real wait between retries. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface ChatMessageInput { role: "system" | "user" | "assistant"; content: string }
export interface ChatRequest {
  model: string;
  messages: ChatMessageInput[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}
export interface CallMeta {
  upstreamRequestId: string | null;
  /** Coarena answered with another model (x-coarena-substituted-to). */
  substitutedTo: string | null;
  attempts: number;
}
export interface ChatResult extends CallMeta { text: string; usage: NormalizedUsage | null; finishReason: string | null }
export interface StreamResult extends CallMeta { usage: NormalizedUsage | null }

function assertBaseUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new LlmProviderError(NAME, "NOT_CONFIGURED"); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production")) throw new LlmProviderError(NAME, "NOT_CONFIGURED");
  if (url.username || url.password) throw new LlmProviderError(NAME, "NOT_CONFIGURED");
  return url.toString().replace(/\/+$/, "");
}

const defaultSleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(new LlmProviderError(NAME, "CANCELLED"));
  const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(t); reject(new LlmProviderError(NAME, "CANCELLED")); };
  signal?.addEventListener("abort", onAbort, { once: true });
});

async function readBounded(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel().catch(() => {}); throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status }); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function requestIdOf(res: Response): string | null {
  return safeRequestId(res.headers.get("x-request-id") ?? res.headers.get("request-id"));
}

/** Turns a non-2xx response into a typed error, reading at most 64 KiB and keeping only the error code. */
async function toError(res: Response): Promise<LlmProviderError> {
  let code: string | null = null;
  try { code = errorCode(JSON.parse(await readBounded(res, MAX_ERROR_BODY))); } catch { await res.body?.cancel().catch(() => {}); }
  return new LlmProviderError(NAME, categorize(res.status, code), { status: res.status, upstreamCode: code, retryAfterMs: parseRetryAfter(res.headers.get("retry-after")), upstreamRequestId: requestIdOf(res) });
}

function asProviderError(error: unknown, signal: AbortSignal | undefined, timedOut: boolean): LlmProviderError {
  if (error instanceof LlmProviderError) return error;
  if (signal?.aborted && !timedOut) return new LlmProviderError(NAME, "CANCELLED");
  if (timedOut) return new LlmProviderError(NAME, "TIMEOUT");
  return new LlmProviderError(NAME, "NETWORK");
}

/**
 * One HTTP call with bounded retries. Only failures before any response body
 * was consumed are retried, so a stream is never replayed after text reached
 * the user, and a failed call is never billed twice (Coarena does not charge
 * refused requests; AIFekr records usage only for the final outcome).
 */
async function call(cfg: AdapterConfig, method: "GET" | "POST", path: string, body: unknown, signal?: AbortSignal): Promise<{ res: Response; attempts: number; release: () => void }> {
  const base = assertBaseUrl(cfg.baseUrl);
  // GET /models is public (no key needed), so model sync works before a key is set.
  if (!cfg.apiKey && path !== "/models") throw new LlmProviderError(NAME, "NOT_CONFIGURED");
  const doFetch = cfg.fetchImpl ?? fetch;
  const sleep = cfg.sleep ?? defaultSleep;
  const policy = cfg.retry ?? DEFAULT_RETRY;
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new LlmProviderError(NAME, "CANCELLED");
    const timeout = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; timeout.abort(); }, Math.max(1000, cfg.timeoutMs));
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
    let error: LlmProviderError;
    try {
      const res = await doFetch(base + path, {
        method,
        signal: combined,
        redirect: "error",
        headers: { ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}), "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (res.ok) return { res, attempts: attempt, release: () => clearTimeout(timer) };
      clearTimeout(timer);
      error = await toError(res);
    } catch (e) {
      clearTimeout(timer);
      error = asProviderError(e, signal, timedOut);
    }
    const delay = retryDelay(attempt, error, policy);
    if (delay === null || error.category === "CANCELLED") throw error;
    await sleep(delay, signal);
  }
}

async function getJson(cfg: AdapterConfig, path: string, signal?: AbortSignal): Promise<{ body: unknown; meta: CallMeta }> {
  const { res, attempts, release } = await call(cfg, "GET", path, undefined, signal);
  try {
    const text = await readBounded(res, MAX_JSON_BODY);
    try { return { body: JSON.parse(text), meta: { upstreamRequestId: requestIdOf(res), substitutedTo: null, attempts } }; }
    catch { throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status }); }
  } finally { release(); }
}

const clampTokens = (n: number | undefined) => (n && Number.isFinite(n) ? Math.max(1, Math.min(Math.floor(n), 200_000)) : undefined);

function chatBody(req: ChatRequest, stream: boolean) {
  const maxTokens = clampTokens(req.maxTokens);
  return {
    model: req.model,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(typeof req.temperature === "number" ? { temperature: Math.max(0, Math.min(2, req.temperature)) } : {}),
  };
}

function substituted(res: Response): string | null {
  const v = res.headers.get("x-coarena-substituted-to");
  return v && /^[A-Za-z0-9._:/-]{1,128}$/.test(v) ? v : null;
}

export async function listModels(cfg: AdapterConfig, signal?: AbortSignal) {
  const { body } = await getJson(cfg, "/models", signal);
  if (!Array.isArray((body as { data?: unknown })?.data)) throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: 200 });
  return normalizeModels(body);
}

/** Free, read-only check: /limits needs a valid key and costs nothing. */
export async function testConnection(cfg: AdapterConfig, signal?: AbortSignal) {
  const started = Date.now();
  const { body, meta } = await getJson(cfg, "/limits", signal);
  return { latencyMs: Date.now() - started, limits: normalizeLimits(body), upstreamRequestId: meta.upstreamRequestId };
}

export async function fetchLimits(cfg: AdapterConfig, signal?: AbortSignal) {
  return normalizeLimits((await getJson(cfg, "/limits", signal)).body);
}

export async function fetchUsage(cfg: AdapterConfig, range: "24h" | "7d" | "30d" = "24h", signal?: AbortSignal) {
  return normalizeUsageReport((await getJson(cfg, `/usage?range=${range}`, signal)).body);
}

export async function fetchRequests(cfg: AdapterConfig, params: { limit?: number; cursor?: string; model?: string; status?: string } = {}, signal?: AbortSignal) {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(Math.max(1, Math.min(100, Math.floor(params.limit)))));
  if (params.cursor && /^[A-Za-z0-9._:=-]{1,200}$/.test(params.cursor)) q.set("cursor", params.cursor);
  if (params.model && /^[A-Za-z0-9._:/-]{1,128}$/.test(params.model)) q.set("model", params.model);
  if (params.status && /^[a-z_]{1,32}$/.test(params.status)) q.set("status", params.status);
  const qs = q.toString();
  return normalizeRequests((await getJson(cfg, "/requests" + (qs ? "?" + qs : ""), signal)).body);
}

export async function fetchRequest(cfg: AdapterConfig, id: string, signal?: AbortSignal) {
  if (!safeRequestId(id)) throw new LlmProviderError(NAME, "INVALID");
  const { body } = await getJson(cfg, "/requests/" + encodeURIComponent(id), signal);
  return normalizeRequests({ data: [(body as { data?: unknown })?.data ?? body] }).data[0] ?? null;
}

export async function chatCompletion(cfg: AdapterConfig, req: ChatRequest): Promise<ChatResult> {
  const { res, attempts, release } = await call(cfg, "POST", "/chat/completions", chatBody(req, false), req.signal);
  try {
    let data: Record<string, unknown>;
    // A reply past 20 s is committed as 200 and padded with newlines first; JSON.parse ignores them.
    try { data = JSON.parse(await readBounded(res, MAX_JSON_BODY)); } catch (e) { throw e instanceof LlmProviderError ? e : new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status }); }
    if (data && typeof data === "object" && "error" in data) throw new LlmProviderError(NAME, "UPSTREAM", { status: res.status, upstreamCode: errorCode(data), upstreamRequestId: requestIdOf(res) });
    const choice = Array.isArray(data.choices) ? (data.choices[0] as { message?: { content?: unknown }; finish_reason?: unknown } | undefined) : undefined;
    const text = typeof choice?.message?.content === "string" ? choice.message.content : null;
    if (text === null) throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status, upstreamRequestId: requestIdOf(res) });
    return { text, usage: normalizeUsage(data.usage), finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null, upstreamRequestId: requestIdOf(res) ?? safeRequestId(typeof data.id === "string" ? data.id : null), substitutedTo: substituted(res), attempts };
  } finally { release(); }
}

/**
 * Streams a chat completion, forwarding text deltas as they arrive. The
 * caller's signal cancels the upstream request (the router's stall guard and a
 * user closing the chat both use it). An `error` event inside the stream is
 * raised as UPSTREAM after whatever text already arrived.
 */
export async function streamChat(cfg: AdapterConfig, req: ChatRequest, onChunk: (text: string) => void): Promise<StreamResult> {
  const { res, attempts, release } = await call(cfg, "POST", "/chat/completions", chatBody(req, true), req.signal);
  release(); // headers arrived: from here the caller's signal and the router's stall guard govern the body
  const meta = { upstreamRequestId: requestIdOf(res), substitutedTo: substituted(res), attempts };
  const reader = res.body?.getReader();
  if (!reader) throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status });
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: NormalizedUsage | null = null;
  const handle = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") return true;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { return false; }
    if (parsed.error) throw new LlmProviderError(NAME, "UPSTREAM", { status: res.status, upstreamCode: errorCode(parsed), upstreamRequestId: meta.upstreamRequestId });
    if (!meta.upstreamRequestId && typeof parsed.id === "string") meta.upstreamRequestId = safeRequestId(parsed.id);
    const delta = Array.isArray(parsed.choices) ? (parsed.choices[0] as { delta?: { content?: unknown } } | undefined)?.delta?.content : undefined;
    if (typeof delta === "string" && delta) onChunk(delta);
    usage = normalizeUsage(parsed.usage) ?? usage;
    return false;
  };
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await reader.read(); } catch (e) { throw asProviderError(e, req.signal, false); }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (handle(line)) return { ...meta, usage };
    }
    if (buffer && handle(buffer)) return { ...meta, usage };
    return { ...meta, usage };
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** POST /responses (OpenAI Responses API), non-streaming. */
export async function createResponse(cfg: AdapterConfig, req: { model: string; input: string | ChatMessageInput[]; instructions?: string; maxOutputTokens?: number; signal?: AbortSignal }): Promise<ChatResult> {
  const maxTokens = clampTokens(req.maxOutputTokens);
  const { res, attempts, release } = await call(cfg, "POST", "/responses", { model: req.model, input: req.input, ...(req.instructions ? { instructions: req.instructions } : {}), ...(maxTokens ? { max_output_tokens: maxTokens } : {}), stream: false }, req.signal);
  try {
    let data: Record<string, unknown>;
    try { data = JSON.parse(await readBounded(res, MAX_JSON_BODY)); } catch (e) { throw e instanceof LlmProviderError ? e : new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status }); }
    let text = typeof data.output_text === "string" ? data.output_text : "";
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output as { content?: { type?: string; text?: unknown }[] }[]) for (const part of item?.content ?? []) if (part?.type === "output_text" && typeof part.text === "string") text += part.text;
    }
    if (!text) throw new LlmProviderError(NAME, "BAD_RESPONSE", { status: res.status, upstreamRequestId: requestIdOf(res) });
    return { text, usage: normalizeUsage(data.usage), finishReason: typeof data.status === "string" ? data.status : null, upstreamRequestId: requestIdOf(res) ?? safeRequestId(typeof data.id === "string" ? data.id : null), substitutedTo: substituted(res), attempts };
  } finally { release(); }
}

/** The adapter contract every dynamic provider implements (registry.ts dispatches on LlmProvider.adapter). */
export const coarenaAdapter = { listModels, testConnection, chatCompletion, streamChat, createResponse, fetchLimits, fetchUsage, fetchRequests, fetchRequest };
export type ProviderAdapter = typeof coarenaAdapter;
