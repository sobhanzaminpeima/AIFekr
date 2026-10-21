/** Adapted from OpenSEO's DataForSEO core/envelope/Labs/SERP/backlinks contracts.
 * Pinned upstream and MIT attribution: third-party/open-seo/NOTICE.md. */
import { z } from "zod";
import { providerAuthorization, seoActions, type SeoAction, type SeoProviderConfig } from "./config";

const ENDPOINTS: Record<SeoAction, string> = {
  keywords: "dataforseo_labs/google/keyword_suggestions/live",
  rank: "serp/google/organic/live/advanced",
  competitors: "dataforseo_labs/google/competitors_domain/live",
  backlinks: "backlinks/summary/live",
  referringDomains: "backlinks/referring_domains/live",
  keywordGap: "dataforseo_labs/google/domain_intersection/live",
  aiVisibility: "ai_optimization/llm_mentions/search_mentions/live",
  backlinkHistory: "backlinks/history/live",
};
export const seoRequestSchema = z.object({
  action: z.enum(seoActions),
  siteId: z.string().min(1).max(100),
  keyword: z.string().trim().max(200).default(""),
  locationCode: z.number().int().positive(),
  languageCode: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  rows: z.number().int().min(1).max(100).default(50),
  competitorDomain: z.string().trim().max(253).regex(/^$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/).default(""),
  platform: z.enum(["google", "chat_gpt"]).default("google"),
}).strict().superRefine((v, ctx) => {
  if (["keywords", "rank"].includes(v.action) && !v.keyword) ctx.addIssue({ code: "custom", path: ["keyword"], message: "Keyword is required" });
  if (v.action === "keywordGap" && !v.competitorDomain) ctx.addIssue({ code: "custom", path: ["competitorDomain"], message: "Competitor domain is required" });
  // These Google operators multiply provider pricing. They are excluded from
  // this fixed-depth action until separately configurable quotation exists.
  if (v.action === "rank" && /(?:allinanchor|allintext|allintitle|allinurl|define|filetype|inanchor|info|intext|intitle|inurl|link|site|id):/i.test(v.keyword)) ctx.addIssue({ code: "custom", path: ["keyword"], message: "PRICE_MULTIPLYING_SEARCH_OPERATOR" });
  if (v.action === "aiVisibility" && v.platform === "chat_gpt" && (v.locationCode !== 2840 || v.languageCode !== "en")) ctx.addIssue({ code: "custom", path: ["platform"], message: "ChatGPT evidence currently supports US/en only" });
});
export type SeoResearchInput = z.infer<typeof seoRequestSchema>;
const nullableNumber = z.number().finite().nonnegative().nullable().optional();
const keywordItem = z.object({ keyword: z.string(), keyword_info: z.object({ search_volume: nullableNumber, cpc: nullableNumber, competition: nullableNumber }).nullable().optional(), keyword_properties: z.object({ keyword_difficulty: nullableNumber }).nullable().optional(), search_intent_info: z.object({ main_intent: z.string().nullable().optional() }).nullable().optional() });
const rankItem = z.object({ type: z.string(), domain: z.string().nullable().optional(), url: z.string().nullable().optional(), title: z.string().nullable().optional(), rank_absolute: nullableNumber, rank_group: nullableNumber });
const competitorItem = z.object({ domain: z.string(), intersections: nullableNumber, avg_position: nullableNumber, full_domain_metrics: z.unknown().optional() });
const backlinkSummary = z.object({ backlinks: nullableNumber, referring_domains: nullableNumber, referring_pages: nullableNumber, broken_backlinks: nullableNumber, rank: nullableNumber });
const referringItem = z.object({ domain: z.string(), backlinks: nullableNumber, rank: nullableNumber, backlinks_spam_score: nullableNumber });
const gapItem = z.object({ keyword_data: keywordItem });
const mentionItem = z.object({ question: z.string().max(20000).nullable().optional(), answer: z.string().max(100000).nullable().optional(), sources: z.array(z.object({ url: z.string().nullable().optional(), title: z.string().nullable().optional(), domain: z.string().nullable().optional() })).nullable().optional(), first_response_at: z.string().nullable().optional(), last_response_at: z.string().nullable().optional() });
const historyItem = z.object({ date: z.string(), backlinks: nullableNumber, referring_domains: nullableNumber, new_backlinks: nullableNumber, lost_backlinks: nullableNumber });
const taskSchema = z.object({ status_code: z.number(), cost: z.number().finite().nonnegative().nullable().optional(), id: z.string().nullable().optional(), result: z.array(z.unknown()).nullable().optional() });
const envelopeSchema = z.object({ status_code: z.number(), cost: z.number().finite().nonnegative().nullable().optional(), tasks: z.array(taskSchema).nullable().optional() });
export class SeoProviderError extends Error {
  constructor(public readonly code: string, public readonly actualCostUsd: number | null = null) { super(code); }
}
export function parseProviderResult(action: SeoAction, raw: unknown) {
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) throw new SeoProviderError("INVALID_PROVIDER_RESPONSE");
  const envelope = parsed.data;
  const task = envelope.tasks?.[0];
  if (envelope.status_code !== 20000) throw new SeoProviderError(envelope.status_code >= 50000 ? "PROVIDER_SERVICE_UNAVAILABLE" : "PROVIDER_REQUEST_FAILED", envelope.cost ?? null);
  if (!task || envelope.tasks?.length !== 1) throw new SeoProviderError("INVALID_PROVIDER_RESPONSE", envelope.cost ?? null);
  const actualCostUsd = task.cost ?? envelope.cost ?? null;
  if (task.status_code !== 20000) throw new SeoProviderError("PROVIDER_TASK_FAILED", actualCostUsd);
  if (actualCostUsd === null) throw new SeoProviderError("INVALID_PROVIDER_RESPONSE");
  try {
    const first = task.result?.[0];
    if (!first || typeof first !== "object") throw Error("missing result");
    if (action === "backlinks") return { data: backlinkSummary.parse(first), actualCostUsd, providerTaskId: task.id || null };
    const items = (first as { items?: unknown }).items ?? [];
    const schema = action === "keywords" ? keywordItem : action === "rank" ? rankItem : action === "competitors" ? competitorItem : action === "keywordGap" ? gapItem : action === "aiVisibility" ? mentionItem : action === "backlinkHistory" ? historyItem : referringItem;
    return { data: z.array(schema).max(100).parse(items), actualCostUsd, providerTaskId: task.id || null };
  } catch { throw new SeoProviderError("INVALID_PROVIDER_RESULT", actualCostUsd); }
}
export function providerPayload(input: SeoResearchInput, domain: string) {
  // Hostname comes from a scoped saved site, not a user-supplied provider URL.
  const market = { location_code: input.locationCode, language_code: input.languageCode };
  if (input.action === "keywords") return { ...market, keyword: input.keyword, limit: input.rows, include_seed_keyword: true };
  if (input.action === "rank") return { ...market, keyword: input.keyword, device: input.device, depth: 10 };
  if (input.action === "competitors") return { ...market, target: domain, limit: input.rows };
  if (input.action === "keywordGap") return { ...market, target1: input.competitorDomain.toLowerCase(), target2: domain, intersections: false, item_types: ["organic"], limit: input.rows };
  if (input.action === "aiVisibility") return { ...market, target: [{ domain, include_subdomains: true, search_filter: "include", search_scope: ["any"] }], platform: input.platform, limit: input.rows };
  if (input.action === "backlinkHistory") {
    const today = new Date(); const from = new Date(today); from.setUTCDate(from.getUTCDate() - Math.min(input.rows - 1, 29));
    return { target: domain, date_from: from.toISOString().slice(0, 10), date_to: today.toISOString().slice(0, 10), rank_scale: "one_hundred" };
  }
  return { target: domain, ...(input.action === "referringDomains" ? { limit: input.rows } : {}) };
}
export async function runProviderResearch(config: SeoProviderConfig, input: SeoResearchInput, domain: string) {
  const response = await fetch(`https://api.dataforseo.com/v3/${ENDPOINTS[input.action]}`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(input.action === "aiVisibility" ? 130_000 : 60_000),
    headers: { Authorization: providerAuthorization(config), "Content-Type": "application/json" },
    body: JSON.stringify([providerPayload(input, domain)]),
  });
  // Paid POST is never automatically retried: timeout may already be billed.
  if (!response.ok) throw new SeoProviderError("PROVIDER_HTTP_ERROR");
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (!reader) throw new SeoProviderError("INVALID_PROVIDER_RESPONSE");
  while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 2_000_000) { await reader.cancel(); throw new SeoProviderError("PROVIDER_RESPONSE_TOO_LARGE"); } chunks.push(next.value); }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new SeoProviderError("INVALID_PROVIDER_RESPONSE"); }
  return parseProviderResult(input.action, raw);
}
