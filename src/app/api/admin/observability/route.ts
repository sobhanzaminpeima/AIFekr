export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { eventVerdict, fallbackVerdict, rateVerdicts } from "@/lib/admin/observability";
import { isMediaUsage } from "@/lib/admin/usageModules";

/** E12, first slice: "is anything broken right now?" for the owner, from stored data only. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  const now = Date.now(), day = new Date(now - 864e5), month = new Date(now - 30 * 864e5);
  const [fallbacks, chat, errors, lastEvent, failedEvents, untokenized, rates] = await Promise.all([
    prisma.providerFallbackLog.groupBy({ by: ["fromProvider"], where: { createdAt: { gte: day } }, _count: { _all: true } }),
    prisma.usageLog.count({ where: { type: "chat", createdAt: { gte: day } } }),
    prisma.errorLog.groupBy({ by: ["source"], where: { createdAt: { gte: day }, level: "error" }, _count: { _all: true } }),
    prisma.inboundEvent.findFirst({ where: { status: { in: ["processed", "failed", "ignored"] } }, orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
    prisma.inboundEvent.count({ where: { status: "failed", receivedAt: { gte: day } } }),
    prisma.usageLog.groupBy({ by: ["type"], where: { createdAt: { gte: month }, tokens: null }, _count: { _all: true } }),
    prisma.billingExchangeRate.findMany({ where: { source: "USD", target: { in: ["IRT", "TRY", "EUR"] } }, orderBy: { validUntil: "desc" }, take: 30, select: { target: true, validUntil: true } }),
  ]);
  const fallbackTotal = fallbacks.reduce((n, f) => n + f._count._all, 0);
  return NextResponse.json({
    checkedAt: new Date(now).toISOString(),
    providers: { verdict: fallbackVerdict(fallbackTotal, chat), failuresLastDay: fallbackTotal, chatRequestsLastDay: chat, byProvider: fallbacks.map((f) => ({ provider: f.fromProvider, failures: f._count._all })) },
    errors: { lastDay: errors.reduce((n, e) => n + e._count._all, 0), bySource: errors.map((e) => ({ source: e.source, count: e._count._all })).sort((a, b) => b.count - a.count).slice(0, 10) },
    events: { verdict: eventVerdict(lastEvent?.receivedAt ?? null, failedEvents, now), lastAcceptedAt: lastEvent?.receivedAt ?? null, failedLastDay: failedEvents },
    usage: { untokenizedTextRequests30d: untokenized.filter((u) => !isMediaUsage(u.type)).reduce((n, u) => n + u._count._all, 0) },
    rates: rateVerdicts(rates, ["IRT", "TRY", "EUR"], now),
  });
}
