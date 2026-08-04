export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");

  // An AGENT can only browse activity attached to a contact/deal assigned to them —
  // no unscoped "all recent activity" feed that would leak other agents' work.
  if (ws.isAgentRestricted) {
    if (contactId) {
      const owned = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, assignedToId: ws.actingUserId } });
      if (!owned) return NextResponse.json({ activities: [] });
    } else if (dealId) {
      const owned = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ownerId: ws.actingUserId } });
      if (!owned) return NextResponse.json({ activities: [] });
    } else {
      return NextResponse.json({ activities: [] });
    }
  }

  const activities = await prisma.crmActivity.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { contactId, dealId, type, content } = await req.json();
  if (!type || !content?.trim()) return NextResponse.json({ error: "نوع و متن فعالیت الزامی است" }, { status: 400 });

  // Only attach to a contact/deal that's actually in this workspace — and, for an
  // AGENT, only one assigned to them.
  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { ownerId: ws.actingUserId } : {}) } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }

  const activity = await prisma.crmActivity.create({
    data: { userId: ws.workspaceUserId, contactId: contactId || undefined, dealId: dealId || undefined, type, content: content.trim() },
  });

  if (contactId) {
    await prisma.crmContact.update({ where: { id: contactId }, data: { lastContact: new Date() } });
  }

  return NextResponse.json({ activity });
}
