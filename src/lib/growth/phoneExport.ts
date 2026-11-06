import { prisma } from "@/lib/db/prisma";
import { getGrowthSettings } from "./config";
import { loadFacts } from "./facts";
import { stageFor } from "./lifecycle";
import { csvEscape } from "./analytics";

/**
 * Super-admin CSV of customers who have a mobile number, for an SMS campaign
 * the owner sends himself. Default audience: everyone who has NOT opted out of
 * marketing (unsubscribed or suppressed on every channel). Every export is
 * audited and limited per hour (see the admin route).
 */
export type PhoneAudience = "not_opted_out" | "consented" | "all";
export const PHONE_EXPORT_LIMIT_PER_HOUR = 3;

/** Stored numbers are 09xxxxxxxxx (Iran) or already +E.164 (others). */
export function toE164(phone: string): string | null {
  const p = phone.trim();
  if (/^09\d{9}$/.test(p)) return `+98${p.slice(1)}`;
  if (/^\+[1-9]\d{6,14}$/.test(p)) return p;
  return null;
}

const COLUMNS = ["name", "phone_e164", "language", "registered_at", "lifecycle_stage", "plan", "last_active", "marketing_consent", "opted_out", "opt_out_source"];

export async function phoneExportRows(audience: PhoneAudience) {
  const settings = await getGrowthSettings(), now = new Date();
  const users = await prisma.user.findMany({
    where: { role: "USER", isBlocked: false, phone: { not: null } },
    select: { id: true, name: true, phone: true, language: true, createdAt: true, plan: true, growthProfile: { select: { marketingConsent: true, unsubscribedAt: true, consentSource: true } }, followupSuppressions: { where: { channel: "all" }, select: { source: true } } },
    orderBy: { createdAt: "asc" }, take: 200_000,
  });
  const rows: { cols: (string | number | null)[]; optedOut: boolean; consent: boolean }[] = [];
  for (let i = 0; i < users.length; i += 900) {
    const part = users.slice(i, i + 900), facts = await loadFacts(part.map(u => u.id), settings.thresholds.scoringWindowDays, now);
    for (const u of part) {
      const e164 = toE164(u.phone!);
      if (!e164) continue;
      const f = facts.get(u.id)!, optedOut = !!u.growthProfile?.unsubscribedAt || u.followupSuppressions.length > 0, consent = !!u.growthProfile?.marketingConsent && !optedOut;
      const source = u.growthProfile?.unsubscribedAt ? (u.growthProfile.consentSource ?? "unsubscribed") : u.followupSuppressions[0]?.source ?? "";
      rows.push({ optedOut, consent, cols: [u.name, e164, u.language ?? "fa", u.createdAt.toISOString().slice(0, 10), stageFor(f, settings, now), u.plan, f.lastActiveAt?.toISOString().slice(0, 10) ?? "", consent ? "yes" : "no", optedOut ? "yes" : "no", source] });
    }
  }
  const kept = rows.filter(r => audience === "all" || (audience === "consented" ? r.consent : !r.optedOut));
  return { total: users.length, exported: kept.length, optedOut: rows.filter(r => r.optedOut).length, rows: kept };
}

export function phoneExportCsv(rows: { cols: (string | number | null)[] }[]): string {
  return "﻿" + [COLUMNS.join(","), ...rows.map(r => r.cols.map(csvEscape).join(","))].join("\n");
}
