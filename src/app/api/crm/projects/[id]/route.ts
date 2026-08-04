export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

const EDITABLE_FIELDS = ["name", "status", "description"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmProject.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if ("endDate" in body) data.endDate = body.endDate ? new Date(body.endDate) : null;

  const project = await prisma.crmProject.update({ where: { id: params.id }, data });
  return NextResponse.json({ project });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmProject.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmProject.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
