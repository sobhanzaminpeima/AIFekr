export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createInvoiceWithNumber, computeInvoiceTotals, InvoiceItemInput } from "@/lib/repositories/crmInvoiceRepository";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
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
  const status = searchParams.get("status");

  const invoices = await prisma.crmInvoice.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(status ? { status } : {}),
      ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}),
    },
    include: { contact: { select: { id: true, name: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const body = await req.json();
  const { contactId, dealId, items, discount, dueDate, notes } = body as {
    contactId: string; dealId?: string; items: InvoiceItemInput[]; discount?: number; dueDate?: string; notes?: string;
  };

  if (!contactId) return NextResponse.json({ error: tri(lang, "contactId الزامی است", "contactId is required", "contactId ist erforderlich") }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: tri(lang, "حداقل یک آیتم فاکتور الزامی است", "At least one invoice item is required", "Mindestens eine Rechnungsposition ist erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
  if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب پیدا نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });

  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, contactId } });
    if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد یا متعلق به این مخاطب نیست", "Deal not found or doesn't belong to this contact", "Deal nicht gefunden oder gehört nicht zu diesem Kontakt") }, { status: 404 });
  }

  const discountAmt = typeof discount === "number" && discount >= 0 ? discount : 0;

  try {
    const { itemsData, subtotal, taxTotal } = computeInvoiceTotals(items);
    const total = Math.max(0, subtotal + taxTotal - discountAmt);

    const invoice = await createInvoiceWithNumber(ws.workspaceUserId, {
      contact: { connect: { id: contactId } },
      deal: dealId ? { connect: { id: dealId } } : undefined,
      subtotal,
      taxTotal,
      discount: discountAmt,
      total,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || undefined,
      items: { create: itemsData },
    });
    return NextResponse.json({ invoice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت فاکتور", "Failed to create invoice", "Fehler beim Erstellen der Rechnung") }, { status: 400 });
  }
}
