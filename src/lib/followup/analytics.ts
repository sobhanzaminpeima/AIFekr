import { prisma } from "@/lib/db/prisma";
import { getGrowthSettings } from "@/lib/growth/config";
import { RULES } from "@/lib/growth/automation";
import { realAdapters } from "./channels";
import { liveSendBlockers } from "./policy";
import { planningMode } from "./engine";
import { getFollowupSettings } from "./settings";

const DAY = 86_400_000;
const ratio = (a: number, b: number) => b > 0 ? Math.round((a / b) * 1000) / 10 : null;

/** Engine state for the admin: settings, what blocks live sending, channel availability and queue counts. */
export async function engineOverview(now = new Date()) {
  const [f, g] = await Promise.all([getFollowupSettings(), getGrowthSettings()]);
  const [byStatus, due, last] = await Promise.all([
    prisma.followupJob.groupBy({ by: ["mode", "status"], _count: { _all: true } }),
    prisma.followupJob.count({ where: { status: "queued", nextAttemptAt: { lte: now } } }),
    prisma.followupJob.findFirst({ where: { processedAt: { not: null } }, orderBy: { processedAt: "desc" }, select: { processedAt: true } }),
  ]);
  return {
    settings: f, planningMode: planningMode(f, g), liveBlockers: liveSendBlockers(f, g),
    growthFlags: { lifecycle_automation_enabled: g.flags.lifecycle_automation_enabled, automated_communications_enabled: g.flags.automated_communications_enabled },
    enabledRules: g.messaging.enabledRules, quietHours: { start: g.messaging.quietStartHour, end: g.messaging.quietEndHour },
    channels: {
      in_app: { available: true },
      email: { available: realAdapters.emailConfigured(), needs: "RESEND_API_KEY + explicit marketing consent" },
      push: { available: process.env.MOBILE_API_ENABLED === "true" && process.env.MOBILE_PUSH_ENABLED === "true", needs: "MOBILE_API_ENABLED + MOBILE_PUSH_ENABLED" },
      sms: { available: false, needs: "marketing SMS consent and owner approval (OTP only today)" },
      whatsapp: { available: false, needs: "no WhatsApp integration or credentials" },
      instagram_dm: { available: false, needs: "Meta allows DMs only as a reply; used for the comment campaign, not for follow-ups" },
    },
    counts: byStatus.map(r => ({ mode: r.mode, status: r.status, n: r._count._all })), due, lastProcessedAt: last?.processedAt ?? null,
  };
}

export type JobFilter = { status?: string; rule?: string; mode?: string; userId?: string; page?: number };

/** Job log for the admin. Shows the rule, channel and outcome; never message text or contact details. */
export async function jobList(filter: JobFilter) {
  const where = { ...(filter.status ? { status: filter.status } : {}), ...(filter.rule ? { ruleKey: filter.rule } : {}), ...(filter.mode ? { mode: filter.mode } : {}), ...(filter.userId ? { userId: filter.userId } : {}) };
  const page = Math.max(1, filter.page || 1), size = 50;
  const [total, rows] = await Promise.all([
    prisma.followupJob.count({ where }),
    prisma.followupJob.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * size, take: size, select: { id: true, userId: true, ruleKey: true, channel: true, mode: true, status: true, reason: true, variant: true, attempts: true, lastError: true, scheduledFor: true, nextAttemptAt: true, processedAt: true, sentAt: true, createdAt: true, user: { select: { name: true } } } }),
  ]);
  return { total, page, size, rows: rows.map(({ user, ...r }) => ({ ...r, userName: user.name })) };
}

/**
 * Per-rule outcomes and conversions in a date range (by processing time).
 * A conversion is a SUCCESS payment within `conversionWindowDays` after the
 * send (or after the holdout decision, for the control group); "returned" is
 * any credit use after it. Lift is shown only with a holdout of at least 30 users.
 */
export async function conversionReport(range: { from: Date; to: Date }) {
  const f = await getFollowupSettings(), win = f.conversionWindowDays * DAY;
  const jobs = await prisma.followupJob.findMany({ where: { processedAt: { gte: range.from, lte: range.to } }, select: { userId: true, ruleKey: true, mode: true, status: true, reason: true, channel: true, processedAt: true }, take: 50_000 });
  const measured = jobs.filter(j => j.status === "sent" || j.status === "holdout" || j.status === "dry_run");
  const ids = [...new Set(measured.map(j => j.userId))];
  const [payments, usage] = ids.length ? await Promise.all([
    prisma.payment.findMany({ where: { userId: { in: ids }, status: "SUCCESS", createdAt: { gte: range.from } }, select: { userId: true, amount: true, createdAt: true } }),
    prisma.usageLog.groupBy({ by: ["userId"], _max: { createdAt: true }, where: { userId: { in: ids }, createdAt: { gte: range.from } } }),
  ]) : [[], []];
  const payBy = new Map<string, { amount: number; createdAt: Date }[]>();
  for (const p of payments) payBy.set(p.userId, [...(payBy.get(p.userId) ?? []), p]);
  const lastUse = new Map(usage.map(u => [u.userId, u._max.createdAt]));
  const converted = (u: string, at: Date) => (payBy.get(u) ?? []).filter(p => p.createdAt >= at && p.createdAt.getTime() - at.getTime() <= win);

  return RULES.map(rule => {
    const rj = jobs.filter(j => j.ruleKey === rule.key);
    const arm = (status: string) => {
      const list = rj.filter(j => j.status === status), conv = list.filter(j => converted(j.userId, j.processedAt!).length);
      const returned = list.filter(j => { const d = lastUse.get(j.userId); return !!d && d >= j.processedAt! && d.getTime() - j.processedAt!.getTime() <= win; });
      return { n: list.length, converted: conv.length, revenueToman: conv.reduce((n, j) => n + converted(j.userId, j.processedAt!).reduce((a, p) => a + p.amount, 0), 0), returned: returned.length, conversionRate: ratio(conv.length, list.length), returnRate: ratio(returned.length, list.length) };
    };
    const sent = arm("sent"), holdout = arm("holdout"), dry = arm("dry_run");
    const suppressed: Record<string, number> = {};
    for (const j of rj.filter(j => j.status === "suppressed" || j.status === "cancelled" || j.status === "failed")) { const k = `${j.status}:${j.reason ?? "-"}`; suppressed[k] = (suppressed[k] ?? 0) + 1; }
    const lift = holdout.n >= 30 && sent.n >= 30 && sent.conversionRate != null && holdout.conversionRate != null ? Math.round((sent.conversionRate - holdout.conversionRate) * 10) / 10 : null;
    return { key: rule.key, kind: rule.kind, name: rule.name, sent, holdout, dryRun: dry, suppressed, liftPoints: lift };
  });
}

/** Follow-up history for Customer 360 (rule, channel, outcome; no text). */
export const customerJobs = (userId: string) => prisma.followupJob.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, ruleKey: true, channel: true, mode: true, status: true, reason: true, variant: true, processedAt: true, sentAt: true, createdAt: true } });
