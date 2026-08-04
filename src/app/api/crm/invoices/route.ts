export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createInvoiceWithNumber } from "@/lib/repositories/crmInvoiceRepository";

interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const status = searchParams.get("status");

  const invoices = await prisma.crmInvoice.findMany({
    where: { userId: user.id, ...(contactId ? { contactId } : {}), ...(status ? { status } : {}) },
    include: { contact: { select: { id: true, name: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { contactId, dealId, items, discount, dueDate, notes } = body as {
    contactId: string; dealId?: string; items: InvoiceItemInput[]; discount?: number; dueDate?: string; notes?: string;
  };

  if (!contactId) return NextResponse.json({ error: "contactId الزامی است" }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "حداقل یک آیتم فاکتور الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
  if (!contact) return NextResponse.json({ error: "مخاطب پیدا نشد" }, { status: 404 });

  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: user.id, contactId } });
    if (!deal) return NextResponse.json({ error: "معامله پیدا نشد یا متعلق به این مخاطب نیست" }, { status: 404 });
  }

  let subtotal = 0;
  let taxTotal = 0;
  const itemsData = items.map((it) => {
    if (!it.description?.trim() || typeof it.unitPrice !== "number" || it.unitPrice < 0) {
      throw new Error("آیتم فاکتور نامعتبر است");
    }
    const qty = typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1;
    const taxRate = typeof it.taxRate === "number" ? it.taxRate : 0;
    const lineSubtotal = qty * it.unitPrice;
    const lineTax = lineSubtotal * (taxRate / 100);
    subtotal += lineSubtotal;
    taxTotal += lineTax;
    return {
      description: it.description.trim(),
      quantity: qty,
      unitPrice: it.unitPrice,
      taxRate,
      lineTotal: lineSubtotal + lineTax,
      productId: it.productId || undefined,
    };
  });

  const discountAmt = typeof discount === "number" && discount >= 0 ? discount : 0;
  const total = Math.max(0, subtotal + taxTotal - discountAmt);

  try {
    const invoice = await createInvoiceWithNumber(user.id, {
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا در ساخت فاکتور" }, { status: 400 });
  }
}
