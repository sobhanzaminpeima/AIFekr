export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const status = searchParams.get("status");

  const projects = await prisma.crmProject.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(status ? { status } : {}),
      ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}),
    },
    include: { contact: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const body = await req.json();
  const { name, contactId, dealId, status, startDate, endDate, description } = body;
  if (!name?.trim()) return NextResponse.json({ error: "نام پروژه الزامی است" }, { status: 400 });

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { ownerId: ws.actingUserId } : {}) } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }

  const project = await prisma.crmProject.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      contactId: contactId || undefined,
      dealId: dealId || undefined,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      description: description || undefined,
    },
  });
  return NextResponse.json({ project });
}
