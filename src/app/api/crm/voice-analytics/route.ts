export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";

/**
 * Aggregate stats for Voice Agent calls tied to this CRM workspace's contacts —
 * powers the "Call Analytics" sub-section of the CRM Analytics tab. VoiceCallLog
 * rows are scoped by userId = workspaceUserId (the agent owner, same as every
 * other CRM workspace query — see src/lib/crm/workspace.ts). An AGENT-restricted
 * user only sees calls linked to a contact assigned to them; unlinked calls
 * (no contactId match) are excluded for them since there's nothing to scope by.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const baseWhere = ws.isAgentRestricted
    ? { userId: ws.workspaceUserId, contact: { assignedToId: ws.actingUserId } }
    : { userId: ws.workspaceUserId };

  const [totalCalls, durationAgg, statusGroups, outcomeGroups, recentCalls, thirtyDayCalls] = await Promise.all([
    prisma.voiceCallLog.count({ where: baseWhere }),
    prisma.voiceCallLog.aggregate({ where: baseWhere, _sum: { durationSec: true }, _avg: { durationSec: true } }),
    prisma.voiceCallLog.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    prisma.voiceCallLog.groupBy({ by: ["outcome"], where: baseWhere, _count: { _all: true } }),
    prisma.voiceCallLog.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, callerPhone: true, direction: true, status: true, outcome: true,
        durationSec: true, createdAt: true, contactId: true,
        contact: { select: { id: true, name: true } },
      },
    }),
    prisma.voiceCallLog.findMany({
      where: { ...baseWhere, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    }),
  ]);

  // Bucket the last 30 days into per-day counts for a simple trend line.
  // (Row count here is bounded to ~30 days of calls, so bucketing in JS is fine
  // rather than a raw SQL date_trunc groupBy.)
  const dayBuckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const call of thirtyDayCalls) {
    const key = call.createdAt.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1);
  }
  const callsPerDay = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));

  const completed = statusGroups.find((g) => g.status === "completed")?._count._all || 0;
  const qualified = outcomeGroups.find((g) => g.outcome === "qualified")?._count._all || 0;
  const appointmentBooked = outcomeGroups.find((g) => g.outcome === "appointment_booked")?._count._all || 0;
  const successRate = totalCalls > 0 ? Math.round(((qualified + appointmentBooked) / totalCalls) * 100) : 0;

  return NextResponse.json({
    totalCalls,
    totalDurationSec: durationAgg._sum.durationSec || 0,
    avgDurationSec: durationAgg._avg.durationSec ? Math.round(durationAgg._avg.durationSec) : 0,
    completedCalls: completed,
    successRate,
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    byOutcome: outcomeGroups.map((g) => ({ outcome: g.outcome || "unknown", count: g._count._all })),
    callsPerDay,
    recentCalls: recentCalls.map((c) => ({
      id: c.id,
      callerPhone: c.callerPhone,
      direction: c.direction,
      status: c.status,
      outcome: c.outcome,
      durationSec: c.durationSec,
      createdAt: c.createdAt,
      contactId: c.contactId,
      contactName: c.contact?.name || null,
    })),
  });
}
