export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { interpolateTemplate } from "@/lib/crm/contractTemplate";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { toJalali } from "@/lib/utils/jalali";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");

  const contracts = await prisma.crmContract.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}),
    },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ contracts });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const body = await req.json();
  const { contactId, dealId, templateId, title, content } = body;
  if (!contactId || !title?.trim()) return NextResponse.json({ error: tri(lang, "contactId و عنوان الزامی است", "contactId and title are required", "contactId und Titel sind erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
  if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب پیدا نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });

  let deal = null;
  if (dealId) {
    deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, contactId } });
    if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد یا متعلق به این مخاطب نیست", "Deal not found or doesn't belong to this contact", "Deal nicht gefunden oder gehört nicht zu diesem Kontakt") }, { status: 404 });
  }

  let finalContent = content || "";
  if (templateId) {
    const template = await prisma.crmContractTemplate.findFirst({ where: { id: templateId, userId: ws.workspaceUserId } });
    if (!template) return NextResponse.json({ error: tri(lang, "قالب پیدا نشد", "Template not found", "Vorlage nicht gefunden") }, { status: 404 });

    let customFields: Record<string, string> = {};
    try { customFields = deal?.customFields ? JSON.parse(deal.customFields) : {}; } catch { /* ignore */ }

    finalContent = interpolateTemplate(template.content, {
      contactName: contact.name,
      contactPhone: contact.phone || "",
      contactEmail: contact.email || "",
      dealTitle: deal?.title || "",
      dealValue: deal ? String(deal.value) : "",
      date: toJalali(new Date()),
      ...customFields,
    });
  }

  if (!finalContent.trim()) return NextResponse.json({ error: tri(lang, "متن قرارداد یا قالب الزامی است", "Contract content or template is required", "Vertragsinhalt oder Vorlage ist erforderlich") }, { status: 400 });

  const contract = await prisma.crmContract.create({
    data: {
      userId: ws.workspaceUserId,
      contactId,
      dealId: dealId || undefined,
      templateId: templateId || undefined,
      title: title.trim(),
      content: finalContent,
    },
  });
  return NextResponse.json({ contract });
}
