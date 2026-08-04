export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

const VALID_STATUSES = ["draft", "sent", "signed", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const contract = await prisma.crmContract.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
    include: { contact: true, deal: { select: { id: true, title: true } } },
  });
  if (!contract) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ contract });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmContract.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { status, content } = body;
  if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  // Editing the content of an already-finalized (not draft) contract snapshots
  // the pre-edit text first — the same guarantee as invoices.
  if (content !== undefined && content !== existing.content && existing.status !== "draft") {
    await prisma.crmContractRevision.create({ data: { contractId: params.id, content: existing.content } });
  }

  const contract = await prisma.crmContract.update({
    where: { id: params.id },
    data: {
      status: status || undefined,
      content: content !== undefined ? content : undefined,
      signedAt: status === "signed" && existing.status !== "signed" ? new Date() : undefined,
    },
  });
  return NextResponse.json({ contract });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmContract.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmContractRevision.deleteMany({ where: { contractId: params.id } });
  await prisma.crmContract.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
