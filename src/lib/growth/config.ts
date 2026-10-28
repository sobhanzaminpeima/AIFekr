import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const GROWTH_SETTINGS_KEY = "growthSettings";

/** Every threshold and weight is a starting hypothesis an admin can change, not a validated model. */
const flags = z.object({
  customer_growth_enabled: z.boolean().default(true),
  customer_event_tracking_enabled: z.boolean().default(true),
  smart_onboarding_enabled: z.boolean().default(true),
  lead_scoring_enabled: z.boolean().default(true),
  personalized_upgrade_enabled: z.boolean().default(true),
  lifecycle_automation_enabled: z.boolean().default(false),
  automated_communications_enabled: z.boolean().default(false),
  ai_customer_insights_enabled: z.boolean().default(false),
  /** Workspace switcher, workspace-first sidebar and home. Off = classic navigation for everyone. */
  adaptive_workspaces_enabled: z.boolean().default(true),
});

const weights = z.object({
  onboardingCompleted: z.number().int().min(0).max(100).default(10),
  firstValue: z.number().int().min(0).max(100).default(20),
  returnedAnotherDay: z.number().int().min(0).max(100).default(15),
  repeatedModuleUse: z.number().int().min(0).max(100).default(15),
  pricingViewed: z.number().int().min(0).max(100).default(10),
  checkoutStarted: z.number().int().min(0).max(100).default(20),
  demoRequested: z.number().int().min(0).max(100).default(10),
});

const thresholds = z.object({
  newUserDays: z.number().int().min(1).max(90).default(7),
  inactiveDays: z.number().int().min(1).max(365).default(14),
  lowCredits: z.number().int().min(0).max(100000).default(30),
  engagedActiveDays: z.number().int().min(1).max(60).default(3),
  highIntentScore: z.number().int().min(1).max(100).default(60),
  atRiskPaidInactiveDays: z.number().int().min(1).max(365).default(14),
  renewalSoonDays: z.number().int().min(1).max(60).default(7),
  /** Score bands: below `nurture` = activation priority, at/above `sales` = sales follow-up. */
  nurtureBand: z.number().int().min(1).max(99).default(40),
  salesBand: z.number().int().min(2).max(100).default(80),
  scoringWindowDays: z.number().int().min(7).max(365).default(30),
});

const messaging = z.object({
  /** Minimum hours between two lifecycle messages to the same user. */
  minHoursBetween: z.number().int().min(1).max(720).default(48),
  maxPer14Days: z.number().int().min(1).max(20).default(4),
  /** Tehran local hours during which nothing is sent. */
  quietStartHour: z.number().int().min(0).max(23).default(22),
  quietEndHour: z.number().int().min(0).max(23).default(8),
  /** Rule keys an admin switched on; every rule starts off. */
  enabledRules: z.array(z.string().max(80)).max(50).default([]),
  /** Admin overrides of the built-in message texts, per rule key. Variables are validated on save. */
  templates: z.record(z.string().max(80), z.object({ titleFa: z.string().max(120), bodyFa: z.string().max(600), titleEn: z.string().max(120), bodyEn: z.string().max(600) })).default({}),
});

export const growthSettingsSchema = z.object({
  flags: flags.prefault({}),
  weights: weights.prefault({}),
  thresholds: thresholds.prefault({}),
  messaging: messaging.prefault({}),
});
export type GrowthSettings = z.infer<typeof growthSettingsSchema>;
export type GrowthFlag = keyof GrowthSettings["flags"];

export const defaultGrowthSettings = (): GrowthSettings => growthSettingsSchema.parse({});

let cache: { at: number; value: GrowthSettings } | null = null;

/** Stored settings merged over safe defaults; a corrupt row falls back to defaults instead of breaking pages. */
export async function getGrowthSettings(): Promise<GrowthSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: GROWTH_SETTINGS_KEY } });
  let value = defaultGrowthSettings();
  if (row) {
    try { const parsed = growthSettingsSchema.safeParse(JSON.parse(row.value)); if (parsed.success) value = parsed.data; } catch { /* keep defaults */ }
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function growthFlag(flag: GrowthFlag): Promise<boolean> {
  return (await getGrowthSettings()).flags[flag];
}

export async function saveGrowthSettings(input: unknown, actorId: string): Promise<GrowthSettings> {
  const value = growthSettingsSchema.parse(input);
  if (value.thresholds.nurtureBand >= value.thresholds.salesBand) throw new Error("INVALID_SCORE_BANDS");
  const before = await getGrowthSettings();
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: GROWTH_SETTINGS_KEY }, create: { key: GROWTH_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } }),
    prisma.auditLog.create({ data: { actorId, action: "growth_settings_updated", metadata: JSON.stringify({ before, after: value }) } }),
  ]);
  cache = { at: Date.now(), value };
  return value;
}
