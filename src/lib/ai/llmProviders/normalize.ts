/**
 * Defensive parsers for provider responses. Every field is optional: a field
 * the provider drops or renames yields null, never a crash. Only whitelisted
 * fields are kept, so a raw response (which may echo account details) is never
 * stored or logged as a whole.
 */
export interface NormalizedModel {
  externalId: string;
  displayName: string;
  description: string | null;
  lifecycle: string | null;
  vision: boolean;
  tools: boolean;
  streaming: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  metadata: { ownedBy: string | null; aliases: string[]; efforts: string[]; pricing: { prompt: string | null; completion: string | null } | null; deprecatedAt: string | null; retiresAt: string | null };
}

export interface NormalizedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Exact cost when the provider reports one. */
  costUsd: number | null;
}

export interface NormalizedLimits {
  usdPerDay: number | null;
  usedTodayUsd: number | null;
  heldTodayUsd: number | null;
  leftTodayUsd: number | null;
  requestsToday: number | null;
  requestsLeft: number | null;
  requestsPerDay: number | null;
  requestsPerMinute: number | null;
  concurrency: number | null;
  resetsAt: string | null;
  refused: { rate: number | null; concurrency: number | null; quota: number | null } | null;
}

export interface NormalizedUsageReport {
  today: { requests: number | null; inputTokens: number | null; outputTokens: number | null; spentUsd: number | null; inFlight: number | null; resetsAt: string | null };
  totals: { requests: number | null; finished: number | null; errors: number | null; inputTokens: number | null; outputTokens: number | null; spentUsd: number | null; latencyP50Ms: number | null; errorRate: number | null } | null;
  models: { id: string; name: string | null; requests: number | null; inputTokens: number | null; outputTokens: number | null; spentUsd: number | null; errorRate: number | null; latencyP50Ms: number | null }[];
  modelsOff: string[];
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const int = (v: unknown): number | null => { const n = num(v); return n === null ? null : Math.max(0, Math.round(n)); };
const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strList = (v: unknown, max = 20): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, max) : []);
/** Times arrive as ISO strings or epoch milliseconds/seconds. */
const time = (v: unknown): string | null => {
  const s = str(v, 64);
  if (s && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  const n = num(v);
  if (n === null || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

/** OpenAI-style `{data:[…]}` model list; entries without a usable id are skipped. */
export function normalizeModels(body: unknown): NormalizedModel[] {
  const list = obj(body)?.data;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: NormalizedModel[] = [];
  for (const raw of list) {
    const m = obj(raw);
    const id = str(m?.id, 128);
    if (!m || !id || !MODEL_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const caps = obj(m.capabilities);
    const pricing = obj(m.pricing);
    out.push({
      externalId: id,
      displayName: str(m.display_name, 120) ?? str(m.name, 120) ?? id,
      description: str(m.description, 500),
      lifecycle: str(m.lifecycle, 40),
      vision: caps?.vision === true,
      tools: caps?.tools === true,
      streaming: caps?.streaming !== false,
      contextWindow: int(m.context_length) ?? int(m.max_input_tokens) ?? int(m.context_window),
      maxOutputTokens: int(m.max_completion_tokens) ?? int(m.max_tokens) ?? int(m.max_output_tokens),
      metadata: {
        ownedBy: str(m.owned_by, 80),
        aliases: strList(m.aliases),
        efforts: strList(caps?.efforts, 10),
        pricing: pricing ? { prompt: str(pricing.prompt, 40), completion: str(pricing.completion, 40) } : null,
        deprecatedAt: time(m.deprecated_at),
        retiresAt: time(m.retires_at),
      },
    });
  }
  return out;
}

/** Token usage from a chat completion or a final stream chunk; null when absent. */
export function normalizeUsage(raw: unknown): NormalizedUsage | null {
  const u = obj(raw);
  if (!u) return null;
  const prompt = int(u.prompt_tokens) ?? int(u.input_tokens);
  const completion = int(u.completion_tokens) ?? int(u.output_tokens);
  if (prompt === null && completion === null) return null;
  const total = int(u.total_tokens) ?? (prompt ?? 0) + (completion ?? 0);
  const cost = num(u.cost_usd) ?? num(u.cost);
  return { promptTokens: prompt ?? 0, completionTokens: completion ?? 0, totalTokens: total, costUsd: cost !== null && cost >= 0 ? cost : null };
}

/** GET /limits → `{data:{usd_per_day, requests_per_day, concurrency, today:{used_usd, left_usd, requests, requests_left, resets_at, refused}}}`. */
export function normalizeLimits(body: unknown): NormalizedLimits {
  const root = obj(body);
  const d = obj(root?.data) ?? root ?? {};
  const today = obj(d.today) ?? {};
  const refused = obj(today.refused);
  return {
    usdPerDay: num(d.usd_per_day),
    usedTodayUsd: num(today.used_usd),
    heldTodayUsd: num(today.held_usd),
    leftTodayUsd: num(today.left_usd),
    requestsToday: int(today.requests),
    requestsLeft: int(today.requests_left),
    requestsPerDay: int(d.requests_per_day),
    requestsPerMinute: int(d.requests_per_minute_account) ?? int(d.requests_per_minute_key),
    concurrency: int(d.concurrency),
    resetsAt: time(today.resets_at),
    refused: refused ? { rate: int(refused.rate), concurrency: int(refused.concurrency), quota: int(refused.quota) } : null,
  };
}

/** GET /usage → `{data:{today:{…}, totals:{…}, models:[…], switches:{models_off:[…]}}}`. */
export function normalizeUsageReport(body: unknown): NormalizedUsageReport {
  const root = obj(body);
  const d = obj(root?.data) ?? root ?? {};
  const today = obj(d.today) ?? {};
  const totals = obj(d.totals);
  const switches = obj(d.switches);
  const models = Array.isArray(d.models) ? d.models : [];
  return {
    today: { requests: int(today.requests), inputTokens: int(today.input_tokens), outputTokens: int(today.output_tokens), spentUsd: num(today.spent_usd), inFlight: int(today.in_flight), resetsAt: time(today.resets_at) },
    totals: totals ? { requests: int(totals.requests), finished: int(totals.finished), errors: int(totals.errors), inputTokens: int(totals.input_tokens), outputTokens: int(totals.output_tokens), spentUsd: num(totals.spent_usd), latencyP50Ms: int(totals.latency_p50_ms), errorRate: num(totals.error_rate) } : null,
    models: models.slice(0, 200).flatMap((raw) => {
      const m = obj(raw), id = str(m?.id, 128);
      return m && id ? [{ id, name: str(m.name, 120), requests: int(m.requests), inputTokens: int(m.input_tokens), outputTokens: int(m.output_tokens), spentUsd: num(m.spent_usd), errorRate: num(m.error_rate), latencyP50Ms: int(m.latency_p50_ms) }] : [];
    }),
    modelsOff: Array.isArray(switches?.models_off) ? switches.models_off.flatMap((m) => { const id = str(obj(m)?.id, 128); return id ? [id] : []; }).slice(0, 200) : [],
  };
}

/** GET /requests → only ids, models, status, tokens, cost and timing; never previews of what was sent or answered. */
export function normalizeRequests(body: unknown) {
  const root = obj(body);
  const list = Array.isArray(root?.data) ? root.data : [];
  return {
    data: list.slice(0, 100).flatMap((raw) => {
      const r = obj(raw), id = str(r?.id, 128);
      if (!r || !id) return [];
      return [{ id, createdAt: time(r.created_at), model: str(r.model, 128), endpoint: str(r.endpoint, 60), status: str(r.status, 40), httpStatus: int(r.http_status), errorCode: str(r.error_code, 64), inputTokens: int(r.input_tokens), outputTokens: int(r.output_tokens), costUsd: num(r.cost_usd), costEstimated: r.cost_estimated === true, latencyMs: int(r.latency_ms) }];
    }),
    nextCursor: str(root?.next_cursor, 200),
    hasMore: root?.has_more === true,
  };
}

/** Error envelope `{error:{code,type}}`: just the stable code, never the message. */
export function errorCode(body: unknown): string | null {
  const e = obj(obj(body)?.error);
  return str(e?.code, 64) ?? str(e?.type, 64);
}
