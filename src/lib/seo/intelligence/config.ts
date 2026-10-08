import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretBox";

export const SEO_PROVIDER_SETTING = "seoIntelligenceProvider";
export const seoActions = ["keywords", "rank", "competitors", "backlinks", "referringDomains", "keywordGap", "aiVisibility", "backlinkHistory"] as const;
export type SeoAction = typeof seoActions[number];
const rate = z.object({ baseUsd: z.number().finite().min(0).max(100), rowUsd: z.number().finite().min(0).max(100) }).strict();
export const seoConfigSchema = z.object({
  enabled: z.boolean().default(false),
  login: z.string().max(200).default(""),
  password: z.string().max(2000).default(""),
  // No invented pricing: admin must confirm current account-specific rates.
  rates: z.partialRecord(z.enum(seoActions), rate.nullable()).default({ keywords: null, rank: null, competitors: null, backlinks: null, referringDomains: null, keywordGap: null, aiVisibility: null, backlinkHistory: null }),
  usdPerCredit: z.number().finite().min(0.000001).max(100).default(0.01),
  markupPercent: z.number().finite().min(0).max(1000).default(0),
  infrastructureUsd: z.number().finite().min(0).max(10).default(0),
  maxRows: z.number().int().min(1).max(100).default(50),
  dailyCredits: z.number().int().min(1).max(100000).default(200),
  dailyJobs: z.number().int().min(1).max(500).default(20),
  maxConcurrent: z.number().int().min(1).max(10).default(1),
}).strict();
export type SeoProviderConfig = z.infer<typeof seoConfigSchema>;

export async function getSeoProviderConfig(): Promise<SeoProviderConfig> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SEO_PROVIDER_SETTING } });
  return seoConfigSchema.parse(row ? JSON.parse(row.value) : {});
}
export function publicSeoConfig(config: SeoProviderConfig) {
  const { login, password, ...safe } = config;
  return { ...safe, configured: !!login && !!password };
}
export async function saveSeoProviderConfig(input: unknown) {
  const parsed = seoConfigSchema.parse(input);
  const old = await getSeoProviderConfig();
  const config = { ...parsed, login: parsed.login ? encryptSecret(parsed.login) : old.login, password: parsed.password ? encryptSecret(parsed.password) : old.password };
  if (config.enabled && (!config.login || !config.password)) throw new Error("PROVIDER_NOT_CONFIGURED");
  await prisma.siteSetting.upsert({ where: { key: SEO_PROVIDER_SETTING }, create: { key: SEO_PROVIDER_SETTING, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
  return publicSeoConfig(config);
}
export function providerAuthorization(config: SeoProviderConfig) {
  if (!config.login || !config.password) throw new Error("PROVIDER_NOT_CONFIGURED");
  return "Basic " + Buffer.from(`${decryptSecret(config.login)}:${decryptSecret(config.password)}`).toString("base64");
}
export function quoteSeoAction(config: SeoProviderConfig, action: SeoAction, rows: number) {
  if (!config.enabled || !config.login || !config.password) throw new Error("PROVIDER_NOT_CONFIGURED");
  const price = config.rates[action];
  if (!price) throw new Error("PRICING_NOT_CONFIGURED");
  if (!Number.isInteger(rows) || rows < 1 || rows > config.maxRows) throw new Error("INVALID_ROW_LIMIT");
  const providerEstimateUsd = price.baseUsd + price.rowUsd * rows;
  if (providerEstimateUsd <= 0) throw new Error("PRICING_NOT_CONFIGURED");
  const retailUsd = providerEstimateUsd * (1 + config.markupPercent / 100) + config.infrastructureUsd;
  const credits = Math.ceil(retailUsd / config.usdPerCredit);
  if (!Number.isSafeInteger(credits) || credits > 1_000_000) throw new Error("COST_OUT_OF_RANGE");
  return { credits, providerEstimateUsd, rows };
}
