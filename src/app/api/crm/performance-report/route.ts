export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Section 1, item 8 — Agent/Team performance report. Deliberately has no
 * storage of its own — every number here is computed from rows already
 * created by items 1–5 (CrmDeal for closed deals & commission, PropertyViewing
 * for viewing→contract conversion), never a separate ledger that could
 * drift from the source data.
 */
async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.performanceReport");
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endDateParam ? new Date(endDateParam) : new Date();
  // Inclusive of the whole end day.
  endDate.setHours(23, 59, 59, 999);

  // AGENT role only ever sees their own row — same restriction the rest of
  // the CRM already applies to deals/viewings via dealAgentFilter()/isAgentRestricted.
  const agentIds = ws.isAgentRestricted
    ? [ws.actingUserId]
    : (await prisma.teamMember.findMany({ where: { team: { ownerId: ws.workspaceUserId } }, select: { userId: true } }))
        .map((m) => m.userId)
        .concat(ws.workspaceUserId);
  const uniqueAgentIds = Array.from(new Set(agentIds));

  const [agents, wonDeals, viewings] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: uniqueAgentIds } }, select: { id: true, name: true } }),
    prisma.crmDeal.findMany({
      where: { userId: ws.workspaceUserId, status: "won", wonAt: { gte: startDate, lte: endDate }, ownerId: { in: uniqueAgentIds } },
      select: { ownerId: true, value: true, commissionAmount: true, commissionRate: true },
    }),
    prisma.propertyViewing.findMany({
      where: { userId: ws.workspaceUserId, scheduledAt: { gte: startDate, lte: endDate }, assignedToId: { in: uniqueAgentIds } },
      select: { assignedToId: true, status: true },
    }),
  ]);

  const report = agents.map((agent) => {
    const agentDeals = wonDeals.filter((d) => d.ownerId === agent.id);
    const agentViewings = viewings.filter((v) => v.assignedToId === agent.id);
    const completedViewings = agentViewings.filter((v) => v.status === "completed").length;

    const commissionVolume = agentDeals.reduce((sum, d) => {
      if (d.commissionAmount != null) return sum + d.commissionAmount;
      if (d.commissionRate != null) return sum + Math.round((d.value * d.commissionRate) / 100);
      return sum;
    }, 0);

    return {
      agentId: agent.id,
      agentName: agent.name,
      propertiesClosedCount: agentDeals.length,
      commissionVolume,
      viewingsScheduled: agentViewings.length,
      viewingsCompleted: completedViewings,
      // Conversion measured against completed viewings (the ones that
      // actually happened), not every slot booked — a no-show/cancellation
      // was never a real chance to convert.
      viewingToContractConversionRate: completedViewings > 0 ? Math.round((agentDeals.length / completedViewings) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ startDate, endDate, report });
}
