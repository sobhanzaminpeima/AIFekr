export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

/** Templates are tenant-editable (§2.2) — clause text and terms can be adjusted to match the tenant's own business policy. Editing a template never touches contracts already generated from it (CrmContract.content is a copy, not a live reference). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: "فقط مدیر یا مالک می‌تواند قالب قرارداد را ویرایش کند" }, { status: 403 });

  const existing = await prisma.crmContractTemplate.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { name, content, industrySlug } = body;

  const template = await prisma.crmContractTemplate.update({
    where: { id: params.id },
    data: {
      name: name?.trim() || undefined,
      content: content !== undefined ? content : undefined,
      industrySlug: industrySlug !== undefined ? industrySlug : undefined,
    },
  });
  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: "فقط مدیر یا مالک می‌تواند قالب قرارداد را حذف کند" }, { status: 403 });

  const existing = await prisma.crmContractTemplate.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmContractTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
