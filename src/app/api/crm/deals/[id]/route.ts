export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, dealAgentFilter } from "@/lib/crm/workspace";

const EDITABLE_FIELDS = ["title", "value", "probability", "expectedCloseDate", "ownerId", "lostReason"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const existing = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    // An AGENT can't reassign a deal to someone else — only MANAGER/OWNER may.
    if (key === "ownerId" && ws.isAgentRestricted) continue;
    if (key in body) data[key] = key === "expectedCloseDate" && body[key] ? new Date(body[key]) : body[key];
  }
  if ("customFields" in body) data.customFields = body.customFields ? JSON.stringify(body.customFields) : null;

  const deal = await prisma.crmDeal.update({ where: { id: params.id }, data });
  return NextResponse.json({ deal });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const existing = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmActivity.deleteMany({ where: { dealId: params.id } });
  await prisma.crmDocument.deleteMany({ where: { dealId: params.id } });
  await prisma.crmDeal.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
