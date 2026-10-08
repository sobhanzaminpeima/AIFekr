import { z } from "zod";
import { getSeoProviderConfig, providerAuthorization, seoActions, type SeoAction } from "./config";
import { readSeoJson } from "./response";
const paths: Record<SeoAction, string> = {
  keywords: "dataforseo_labs.keyword_suggestions.live",
  rank: "serp.live.advanced",
  competitors: "dataforseo_labs.competitors_domain.live",
  keywordGap: "dataforseo_labs.domain_intersection.live",
  backlinks: "backlinks.summary.live",
  referringDomains: "backlinks.referring_domains.live",
  backlinkHistory: "backlinks.history.live",
  aiVisibility: "ai_optimization.llm_mentions.search_mentions.live",
};
const costs = z.array(z.object({ cost_type: z.enum(["per_request", "per_result"]), cost: z.number().finite().nonnegative() })).min(1).max(2);
function atPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, root);
}
export function parseSeoAccountRates(price: unknown) {
  return Object.fromEntries(seoActions.map(action => {
    const parsed = costs.safeParse(atPath(price, `${paths[action]}.priority_normal`));
    if (!parsed.success || new Set(parsed.data.map(cost => cost.cost_type)).size !== parsed.data.length) return [action, null];
    const baseUsd = parsed.data.find(cost => cost.cost_type === "per_request")?.cost;
    const rowUsd = parsed.data.find(cost => cost.cost_type === "per_result")?.cost || 0;
    if (baseUsd === undefined || baseUsd > 100 || rowUsd > 100 || baseUsd + rowUsd <= 0) return [action, null];
    return [action, { baseUsd, rowUsd }];
  })) as Record<SeoAction, { baseUsd: number; rowUsd: number } | null>;
}
export async function getSeoAccountRates() {
  const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: providerAuthorization(await getSeoProviderConfig()) }, redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("ACCOUNT_PRICING_UNAVAILABLE");
  const body = z.object({ status_code: z.literal(20000), tasks: z.array(z.object({ status_code: z.literal(20000), result: z.array(z.object({ price: z.record(z.string(), z.unknown()) })).length(1) })).length(1) }).parse(await readSeoJson(response));
  return { rates: parseSeoAccountRates(body.tasks[0].result[0].price), checkedAt: new Date().toISOString() };
}
