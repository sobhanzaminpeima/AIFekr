import { createHash } from "crypto";
import type { GrowthSettings } from "@/lib/growth/config";
import { inQuietHours, tehranHour } from "@/lib/growth/automation";
import type { FollowupSettings } from "./settings";

/** Pure decision rules of the follow-up engine (no DB), so every safety rule is unit-tested. */

export type Channel = "in_app" | "email";

/** Exponential backoff: base, 2×base, 4×base… capped at maxMinutes. `attempt` is the attempt that just failed (1-based). */
export function backoffMinutes(attempt: number, retry: FollowupSettings["retry"]): number {
  return Math.min(retry.maxMinutes, retry.baseMinutes * 2 ** Math.max(0, attempt - 1));
}

const HOUR = 3_600_000, DAY = 24 * HOUR;

/**
 * Frequency caps over the user's real sends (live mode) or recorded dry runs
 * (dry-run mode). Returns the earliest time the cap frees up when blocked.
 */
export function capDecision(sentAt: Date[], now: Date, caps: FollowupSettings["caps"]): { ok: true } | { ok: false; retryAt: Date; cap: "per24h" | "per7d" } {
  const t = now.getTime();
  const last24 = sentAt.filter(d => t - d.getTime() < DAY).sort((a, b) => a.getTime() - b.getTime());
  if (last24.length >= caps.per24h) return { ok: false, cap: "per24h", retryAt: new Date(last24[last24.length - caps.per24h].getTime() + DAY) };
  const last7 = sentAt.filter(d => t - d.getTime() < 7 * DAY).sort((a, b) => a.getTime() - b.getTime());
  if (last7.length >= caps.per7d) return { ok: false, cap: "per7d", retryAt: new Date(last7[last7.length - caps.per7d].getTime() + 7 * DAY) };
  return { ok: true };
}

/** First moment at or after `now` outside the Tehran quiet window (start..end hours, wraps midnight). */
export function quietUntil(now: Date, start: number, end: number): Date | null {
  if (!inQuietHours(now, start, end)) return null;
  const h = tehranHour(now), hoursLeft = (end - h + 24) % 24 || 24;
  // Tehran is UTC+3:30, so its minute is the UTC minute shifted by 30.
  const tehranMinute = (now.getUTCMinutes() + 30) % 60;
  return new Date(now.getTime() + hoursLeft * HOUR - tehranMinute * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds());
}

/** Deterministic holdout arm for one user and rule, so a re-plan never moves a user between arms. */
export function holdoutVariant(userId: string, ruleKey: string, percent: number): "treatment" | "holdout" {
  if (percent <= 0) return "treatment";
  const n = parseInt(createHash("sha256").update(`${ruleKey}:${userId}`).digest("hex").slice(0, 8), 16) % 100;
  return n < percent ? "holdout" : "treatment";
}

/**
 * Picks the delivery channel. Email needs the email channel on, an address and
 * explicit marketing consent (registration is not consent); otherwise in-app.
 * A channel the user or an admin suppressed is never used.
 */
export function chooseChannel(input: { channels: FollowupSettings["channels"]; hasEmail: boolean; marketingConsent: boolean; suppressed: Set<string> }): Channel | null {
  if (input.suppressed.has("all")) return null;
  if (input.channels.email && input.hasEmail && input.marketingConsent && !input.suppressed.has("email")) return "email";
  if (input.channels.in_app && !input.suppressed.has("in_app")) return "in_app";
  return null;
}

/** Everything that stops a real send. Empty = live sending is allowed for this rule. */
export function liveSendBlockers(f: FollowupSettings, g: GrowthSettings, ruleKey?: string): string[] {
  const out: string[] = [];
  if (!f.engine_enabled) out.push("engine_disabled");
  if (f.mode !== "live") out.push("dry_run_mode");
  if (!g.flags.lifecycle_automation_enabled) out.push("lifecycle_automation_disabled");
  if (!g.flags.automated_communications_enabled) out.push("communications_disabled");
  if (!f.channels.in_app && !f.channels.email) out.push("no_channel_enabled");
  if (ruleKey && !g.messaging.enabledRules.includes(ruleKey)) out.push("rule_disabled");
  return out;
}

/** Statuses after which a job is never touched again. */
export const FINAL_STATUSES = ["sent", "dry_run", "suppressed", "holdout", "failed", "cancelled"] as const;
