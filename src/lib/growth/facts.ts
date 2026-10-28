import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CustomerFacts } from "./lifecycle";

type Success = Record<string, { count: number; first: Date }>;
type Group = { userId: string | null; _count: { _all: number }; _min: { createdAt?: Date | null; updatedAt?: Date | null } };

/**
 * Batch-loads CustomerFacts for a set of users with grouped queries (one per
 * source table, no per-user N+1). "Success" only counts rows that exist after
 * a real outcome: generated assets, READY voice audio, assistant replies,
 * saved CRM contacts, finished SEO audits, etc.
 */
export async function loadFacts(userIds: string[], windowDays: number, now = new Date()): Promise<Map<string, CustomerFacts>> {
  const out = new Map<string, CustomerFacts>();
  if (!userIds.length) return out;
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const ids = { in: userIds };
  const users = await prisma.user.findMany({ where: { id: ids }, select: { id: true, createdAt: true, plan: true, planExpiry: true, credits: true, role: true, onboardingDone: true, lastLoginAt: true, growthProfile: { select: { onboardingState: true, unsubscribedAt: true, marketingConsent: true } } } });

  const successes = new Map<string, Success>();
  const put = (moduleId: string, rows: Group[]) => {
    for (const r of rows) {
      const first = r._min.createdAt ?? r._min.updatedAt;
      if (!r.userId || !first) continue;
      const m = successes.get(r.userId) ?? {};
      const prev = m[moduleId];
      m[moduleId] = { count: (prev?.count ?? 0) + r._count._all, first: prev && prev.first < first ? prev.first : first };
      successes.set(r.userId, m);
    }
  };
  const byUser = { by: ["userId"] as ["userId"], _count: { _all: true as const }, _min: { createdAt: true as const } };
  const [images, videos, music, voice, factory, seo, social, sites, student, crm, fitness] = await Promise.all([
    prisma.generatedImage.groupBy({ ...byUser, where: { userId: ids } }),
    prisma.generatedVideo.groupBy({ ...byUser, where: { userId: ids, refunded: false } }),
    prisma.generatedMusic.groupBy({ ...byUser, where: { userId: ids, refunded: false } }),
    prisma.voiceStudioGeneration.groupBy({ ...byUser, where: { userId: ids, status: { in: ["READY", "DELETED"] }, storageKey: { not: null } } }),
    prisma.videoFactoryProject.groupBy({ ...byUser, where: { userId: ids, deletedAt: null } }),
    prisma.seoAudit.groupBy({ ...byUser, where: { userId: ids } }),
    prisma.socialPost.groupBy({ ...byUser, where: { userId: ids } }),
    prisma.generatedWebsite.groupBy({ ...byUser, where: { userId: ids } }),
    prisma.studentMaterial.groupBy({ ...byUser, where: { userId: ids } }),
    // Tenant CRM: only a per-owner COUNT is read, never contact data.
    prisma.crmContact.groupBy({ ...byUser, where: { userId: ids } }),
    prisma.fitnessProfile.groupBy({ by: ["userId"], _count: { _all: true }, _min: { updatedAt: true }, where: { userId: ids } }),
  ]);
  put("image", images); put("video", videos); put("music", music); put("voice-studio", voice); put("video-factory", factory);
  put("seo", seo); put("social", social); put("website-designer", sites); put("student", student); put("crm", crm as Group[]); put("fitness", fitness as Group[]);

  const idList = Prisma.join(userIds);
  const chats = await prisma.$queryRaw<{ userId: string; n: bigint; first: string | Date | number | bigint }[]>`SELECT c.userId AS userId, COUNT(DISTINCT c.id) AS n, MIN(m.createdAt) AS first FROM Message m JOIN Conversation c ON c.id = m.conversationId WHERE m.role = 'assistant' AND c.userId IN (${idList}) GROUP BY c.userId`;
  put("chat", chats.map(c => ({ userId: c.userId, _count: { _all: Number(c.n) }, _min: { createdAt: new Date(typeof c.first === "bigint" || typeof c.first === "number" ? Number(c.first) : c.first) } })));

  const [refunds, usage, activeDays, lastUsage, events, payments, lastFailed, checkouts, lastEvents] = await Promise.all([
    prisma.usageLog.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: ids, credits: { lt: 0 }, createdAt: { gte: since } } }),
    prisma.usageLog.groupBy({ by: ["userId"], _sum: { credits: true }, where: { userId: ids, createdAt: { gte: since } } }),
    prisma.$queryRaw<{ userId: string; d: bigint }[]>`SELECT userId, COUNT(DISTINCT day) AS d FROM (SELECT userId, date(createdAt / 1000, 'unixepoch') AS day FROM UsageLog WHERE userId IN (${idList}) AND createdAt >= ${since.getTime()} UNION SELECT userId, date(createdAt / 1000, 'unixepoch') FROM GrowthEvent WHERE userId IN (${idList}) AND createdAt >= ${since.getTime()}) GROUP BY userId`,
    prisma.usageLog.groupBy({ by: ["userId"], _max: { createdAt: true }, where: { userId: ids } }),
    prisma.growthEvent.groupBy({ by: ["userId", "name"], _count: { _all: true }, _max: { createdAt: true }, where: { userId: ids, OR: [{ name: { in: ["pricing_page_viewed", "plan_selected", "upgrade_prompt_clicked"] }, createdAt: { gte: since } }, { name: "demo_requested" }] } }),
    prisma.payment.groupBy({ by: ["userId", "status"], _count: { _all: true }, _sum: { amount: true }, _min: { createdAt: true }, where: { userId: ids } }),
    prisma.payment.groupBy({ by: ["userId"], _max: { createdAt: true }, where: { userId: ids, status: "FAILED" } }),
    prisma.payment.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: ids, createdAt: { gte: since } } }),
    prisma.growthEvent.groupBy({ by: ["userId"], _max: { createdAt: true }, where: { userId: ids } }),
  ]);
  const map = <T extends { userId: string | null }>(rows: T[]) => new Map(rows.filter(r => r.userId).map(r => [r.userId as string, r]));
  const lastEventBy = map(lastEvents), refundBy = map(refunds), usageBy = map(usage), daysBy = new Map(activeDays.map(r => [r.userId, Number(r.d)])), lastBy = map(lastUsage), failedBy = map(lastFailed), checkoutBy = map(checkouts);

  for (const u of users) {
    const ev = events.filter(e => e.userId === u.id);
    const count = (...names: string[]) => ev.filter(e => names.includes(e.name)).reduce((n, e) => n + e._count._all, 0);
    const lastEvent = lastEventBy.get(u.id)?._max.createdAt ?? null;
    const pay = payments.filter(p => p.userId === u.id), ok = pay.find(p => p.status === "SUCCESS");
    const last = [u.lastLoginAt, lastBy.get(u.id)?._max.createdAt ?? null, lastEvent].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    out.set(u.id, {
      userId: u.id, createdAt: u.createdAt, plan: u.plan, planExpiry: u.planExpiry, credits: u.credits, role: u.role,
      onboardingDone: u.onboardingDone, onboardingState: u.growthProfile?.onboardingState ?? (u.onboardingDone ? "completed" : "not_started"),
      successes: successes.get(u.id) ?? {}, failedOperations: refundBy.get(u.id)?._count._all ?? 0,
      creditsUsedWindow: Math.max(0, usageBy.get(u.id)?._sum.credits ?? 0), activeDaysWindow: daysBy.get(u.id) ?? 0, lastActiveAt: last,
      pricingViewsWindow: count("pricing_page_viewed", "plan_selected", "upgrade_prompt_clicked"), demoRequests: count("demo_requested"),
      checkoutsWindow: checkoutBy.get(u.id)?._count._all ?? 0,
      payments: { success: ok?._count._all ?? 0, failed: pay.find(p => p.status === "FAILED")?._count._all ?? 0, pending: pay.find(p => p.status === "PENDING")?._count._all ?? 0, revenueToman: ok?._sum.amount ?? 0, firstPaidAt: ok?._min.createdAt ?? null, lastFailedAt: failedBy.get(u.id)?._max.createdAt ?? null },
      unsubscribed: !!u.growthProfile?.unsubscribedAt, marketingConsent: !!u.growthProfile?.marketingConsent,
    });
  }
  return out;
}
