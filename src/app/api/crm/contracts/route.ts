export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { interpolateTemplate } from "@/lib/crm/contractTemplate";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");

  const contracts = await prisma.crmContract.findMany({
    where: { userId: user.id, ...(contactId ? { contactId } : {}) },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ contracts });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { contactId, dealId, templateId, title, content } = body;
  if (!contactId || !title?.trim()) return NextResponse.json({ error: "contactId و عنوان الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
  if (!contact) return NextResponse.json({ error: "مخاطب پیدا نشد" }, { status: 404 });

  let deal = null;
  if (dealId) {
    deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: user.id, contactId } });
    if (!deal) return NextResponse.json({ error: "معامله پیدا نشد یا متعلق به این مخاطب نیست" }, { status: 404 });
  }

  let finalContent = content || "";
  if (templateId) {
    const template = await prisma.crmContractTemplate.findFirst({ where: { id: templateId, userId: user.id } });
    if (!template) return NextResponse.json({ error: "قالب پیدا نشد" }, { status: 404 });

    let customFields: Record<string, string> = {};
    try { customFields = deal?.customFields ? JSON.parse(deal.customFields) : {}; } catch { /* ignore */ }

    finalContent = interpolateTemplate(template.content, {
      contactName: contact.name,
      contactPhone: contact.phone || "",
      contactEmail: contact.email || "",
      dealTitle: deal?.title || "",
      dealValue: deal ? String(deal.value) : "",
      ...customFields,
    });
  }

  if (!finalContent.trim()) return NextResponse.json({ error: "متن قرارداد یا قالب الزامی است" }, { status: 400 });

  const contract = await prisma.crmContract.create({
    data: {
      userId: user.id,
      contactId,
      dealId: dealId || undefined,
      templateId: templateId || undefined,
      title: title.trim(),
      content: finalContent,
    },
  });
  return NextResponse.json({ contract });
}
