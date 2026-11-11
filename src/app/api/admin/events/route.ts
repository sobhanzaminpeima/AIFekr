export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** E6: the inbound event log for admins: latest events and 7-day counts per source and status. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  const source = req.nextUrl.searchParams.get("source") || undefined;
  const since = new Date(Date.now() - 7 * 864e5);
  const [events, counts, last] = await Promise.all([
    prisma.inboundEvent.findMany({ where: source ? { source } : {}, orderBy: { receivedAt: "desc" }, take: 200 }),
    prisma.inboundEvent.groupBy({ by: ["source", "status"], where: { receivedAt: { gte: since } }, _count: { _all: true }, _avg: { latencyMs: true } }),
    prisma.inboundEvent.findFirst({ where: { status: { in: ["processed", "failed", "ignored"] } }, orderBy: { receivedAt: "desc" }, select: { receivedAt: true, source: true } }),
  ]);
  return NextResponse.json({
    events,
    week: counts.map((c) => ({ source: c.source, status: c.status, count: c._count._all, avgLatencyMs: c._avg.latencyMs == null ? null : Math.round(c._avg.latencyMs) })),
    lastAcceptedAt: last?.receivedAt ?? null,
  });
}
