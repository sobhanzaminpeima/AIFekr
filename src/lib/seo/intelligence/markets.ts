import { z } from "zod";
import { getSeoProviderConfig, providerAuthorization } from "./config";
import type { SeoResearchInput } from "./provider";
import { readSeoJson } from "./response";
const entry = z.object({ location_code: z.number().int(), location_name: z.string(), available_languages: z.array(z.object({ language_code: z.string(), language_name: z.string(), available_platforms: z.array(z.string()).optional() })) });
export function parseSeoMarkets(raw: unknown) {
  const envelope = z.object({ status_code: z.literal(20000), tasks: z.array(z.object({ status_code: z.literal(20000), result: z.array(entry).max(5000) })).min(1) }).parse(raw);
  return envelope.tasks[0].result;
}
type Market = z.infer<typeof entry>;
const cached = new Map<string, { until: number; markets: Market[] }>();
const pending = new Map<string, Promise<Market[]>>();
export async function getSeoMarkets(kind: "labs" | "ai" = "labs") {
  const config = await getSeoProviderConfig();
  if (!config.enabled || !config.login || !config.password) throw Error("PROVIDER_NOT_CONFIGURED");
  const hit = cached.get(kind);
  if (hit && hit.until > Date.now()) return hit.markets;
  if (pending.has(kind)) return pending.get(kind)!;
  const request = (async () => {
    const path = kind === "ai" ? "ai_optimization/llm_mentions/locations_and_languages" : "dataforseo_labs/locations_and_languages";
    const response = await fetch(`https://api.dataforseo.com/v3/${path}`, { headers: { Authorization: providerAuthorization(config) }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("MARKETS_UNAVAILABLE");
    const markets = parseSeoMarkets(await readSeoJson(response));
    cached.set(kind, { markets, until: Date.now() + 86400000 });
    return markets;
  })().finally(() => { pending.delete(kind); });
  pending.set(kind, request);
  return request;
}
export function marketSupports(markets: Market[], input: SeoResearchInput) {
  const language = markets.find(market => market.location_code === input.locationCode)?.available_languages.find(language => language.language_code === input.languageCode);
  return !!language && (input.action !== "aiVisibility" || !!language.available_platforms?.includes(input.platform));
}
export async function validateSeoMarket(input: SeoResearchInput) {
  if (["backlinks", "referringDomains", "backlinkHistory"].includes(input.action)) return;
  if (!marketSupports(await getSeoMarkets(input.action === "aiVisibility" ? "ai" : "labs"), input)) throw Error("UNSUPPORTED_SEARCH_MARKET");
}
