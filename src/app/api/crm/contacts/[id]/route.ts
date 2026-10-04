export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, agentFilter, businessFilter } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const contact = await prisma.crmContact.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...businessFilter(ws), ...agentFilter(ws) },
    include: {
      deals: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });
  return NextResponse.json({ contact });
}

const EDITABLE_FIELDS = ["name", "phone", "email", "whatsapp", "telegram", "company", "status", "source", "tags", "assignedToId"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const existing = await prisma.crmContact.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...businessFilter(ws), ...agentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    // An AGENT can't reassign a contact away from (or to) themselves — only MANAGER/OWNER may.
    if (key === "assignedToId" && ws.isAgentRestricted) continue;
    if (key in body) data[key] = body[key];
  }
  if ("customFields" in body) data.customFields = body.customFields ? JSON.stringify(body.customFields) : null;
  if ("sourceDetails" in body) data.sourceDetails = body.sourceDetails ? JSON.stringify(body.sourceDetails) : null;

  const contact = await prisma.crmContact.update({ where: { id: params.id }, data });
  return NextResponse.json({ contact });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const existing = await prisma.crmContact.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...businessFilter(ws), ...agentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.crmActivity.deleteMany({ where: { contactId: params.id, ...businessFilter(ws) } });
  await prisma.crmTask.deleteMany({ where: { contactId: params.id, ...businessFilter(ws) } });
  await prisma.crmDocument.deleteMany({ where: { contactId: params.id, ...businessFilter(ws) } });
  const deals = await prisma.crmDeal.findMany({ where: { contactId: params.id, ...businessFilter(ws) }, select: { id: true } });
  if (deals.length > 0) {
    return NextResponse.json({ error: tri(lang, "این مخاطب معامله فعال دارد — ابتدا معاملات را حذف یا منتقل کنید", "This contact has active deals — delete or transfer the deals first", "Dieser Kontakt hat aktive Deals — löschen oder übertragen Sie die Deals zuerst") }, { status: 400 });
  }
  await prisma.crmContact.deleteMany({ where: { id: params.id, userId: ws.workspaceUserId, ...businessFilter(ws) } });
  return NextResponse.json({ success: true });
}
