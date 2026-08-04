export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { moveDealToStage } from "@/lib/repositories/crmRepository";
import { resolveCrmWorkspace, dealAgentFilter } from "@/lib/crm/workspace";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { stageId, lostReason } = await req.json();
  if (!stageId) return NextResponse.json({ error: "شناسه مرحله الزامی است" }, { status: 400 });

  if (ws.isAgentRestricted) {
    const owned = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
    if (!owned) return NextResponse.json({ error: "معامله یا مرحله یافت نشد" }, { status: 404 });
  }

  const deal = await moveDealToStage(ws.workspaceUserId, params.id, stageId, lostReason || undefined);
  if (!deal) return NextResponse.json({ error: "معامله یا مرحله یافت نشد" }, { status: 404 });

  return NextResponse.json({ deal });
}
