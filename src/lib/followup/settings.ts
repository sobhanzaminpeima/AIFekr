import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const FOLLOWUP_SETTINGS_KEY = "followupSettings";

/**
 * Per-scenario mode: "off" plans nothing; "dry_run" records intended sends only;
 * "internal_test" really sends, but only to `testUserIds` (everyone else is a
 * dry run); "live" sends to every eligible user. Owner-approved scenarios A, C, G
 * and H start in dry run; every other rule starts off.
 */
export const RULE_MODES = ["off", "dry_run", "internal_test", "live"] as const;
export type RuleMode = typeof RULE_MODES[number];
export const DEFAULT_RULE_MODES: Record<string, RuleMode> = { getting_started_24h: "dry_run", first_result_30m: "dry_run", payment_failed: "dry_run", inactive_3d: "dry_run" };

/**
 * Follow-up engine settings (SiteSetting `followupSettings`). Every default is
 * the safe one: the engine is off, and when an admin turns it on it starts in
 * dry-run mode with every channel off. Real sending also needs both growth
 * flags (`lifecycle_automation_enabled` + `automated_communications_enabled`)
 * and the rule switched on in Automations: see `liveSendBlockers`.
 */
export const followupSettingsSchema = z.object({
  engine_enabled: z.boolean().default(false),
  /** "dry_run" records what would be sent; "live" really sends. Only a SUPER_ADMIN can choose "live". */
  mode: z.enum(["dry_run", "live"]).default("dry_run"),
  channels: z.object({
    in_app: z.boolean().default(false),
    /** Needs RESEND_API_KEY on the server and explicit marketing consent per user. */
    email: z.boolean().default(false),
    /** Mobile push for in-app follow-ups; also needs MOBILE_API_ENABLED + MOBILE_PUSH_ENABLED. */
    push: z.boolean().default(false),
  }).prefault({}),
  caps: z.object({
    per24h: z.number().int().min(1).max(5).default(1),
    per7d: z.number().int().min(1).max(20).default(3),
  }).prefault({}),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(4),
    baseMinutes: z.number().int().min(1).max(240).default(15),
    maxMinutes: z.number().int().min(15).max(2880).default(720),
  }).prefault({}),
  /** A job that could not be sent within this many hours of its plan (caps, quiet hours, retries) expires. */
  expireHours: z.number().int().min(6).max(336).default(72),
  /** Share of eligible users per rule held back (not messaged) to measure lift. 0 = no experiment. */
  holdoutPercent: z.number().int().min(0).max(50).default(0),
  /** Days after a send (or holdout) in which a purchase counts as a conversion. */
  conversionWindowDays: z.number().int().min(1).max(60).default(7),
  batchSize: z.number().int().min(10).max(1000).default(200),
  ruleModes: z.record(z.string().max(80), z.enum(RULE_MODES)).default(DEFAULT_RULE_MODES),
  /** Accounts that receive "internal_test" scenarios for real (staff test accounts). */
  testUserIds: z.array(z.string().min(5).max(40)).max(20).default([]),
  /** Admin switch for the AIFekr Live Instagram launch attribution card and its follow-up rule. */
  live_campaign_enabled: z.boolean().default(false),
});
export type FollowupSettings = z.infer<typeof followupSettingsSchema>;
export const defaultFollowupSettings = (): FollowupSettings => followupSettingsSchema.parse({});

let cache: { at: number; value: FollowupSettings } | null = null;
export const clearFollowupSettingsCache = () => { cache = null; };

/** Stored settings over safe defaults; a corrupt row falls back to defaults (engine off). */
export async function getFollowupSettings(): Promise<FollowupSettings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: FOLLOWUP_SETTINGS_KEY } });
  let value = defaultFollowupSettings();
  if (row) { try { const p = followupSettingsSchema.safeParse(JSON.parse(row.value)); if (p.success) value = p.data; } catch { /* defaults */ } }
  cache = { at: Date.now(), value };
  return value;
}

/** Changes that can start real outreach; only a SUPER_ADMIN may make them. */
export function outreachEscalations(before: FollowupSettings, after: FollowupSettings): string[] {
  const out: string[] = [];
  if (after.mode === "live" && before.mode !== "live") out.push("mode_live");
  for (const c of ["in_app", "email", "push"] as const) if (after.channels[c] && !before.channels[c]) out.push(`channel_${c}`);
  if (after.engine_enabled && !before.engine_enabled && after.mode === "live") out.push("engine_on_live");
  if (after.live_campaign_enabled && !before.live_campaign_enabled) out.push("live_campaign");
  const sends = (m: string | undefined) => m === "live" || m === "internal_test";
  for (const [k, m] of Object.entries(after.ruleModes)) if (sends(m) && before.ruleModes[k] !== m && !(m === "internal_test" && before.ruleModes[k] === "live")) out.push(`rule_${k}_${m}`);
  if (after.testUserIds.some(id => !before.testUserIds.includes(id))) out.push("test_users_added");
  return out;
}

export async function saveFollowupSettings(input: unknown, actor: { id: string; role: string }): Promise<FollowupSettings> {
  const value = followupSettingsSchema.parse(input);
  if (value.caps.per24h > value.caps.per7d) throw new Error("INVALID_CAPS");
  const before = await getFollowupSettings();
  const escalations = outreachEscalations(before, value);
  if (escalations.length && actor.role !== "SUPER_ADMIN") throw new Error("SUPER_ADMIN_REQUIRED");
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: FOLLOWUP_SETTINGS_KEY }, create: { key: FOLLOWUP_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "followup_settings_updated", metadata: JSON.stringify({ before, after: value, escalations }) } }),
  ]);
  cache = { at: Date.now(), value };
  return value;
}
