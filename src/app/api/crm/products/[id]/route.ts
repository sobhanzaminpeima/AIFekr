export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

/** Product detail + the contacts who've had this product on an invoice — lets the UI answer "who bought this?" from a click. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const product = await prisma.crmProduct.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!product) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const invoiceItems = await prisma.crmInvoiceItem.findMany({
    where: { productId: params.id },
    include: { invoice: { select: { id: true, invoiceNumber: true, status: true, contact: { select: { id: true, name: true } } } } },
  });
  const contactsMap = new Map<string, { id: string; name: string }>();
  for (const item of invoiceItems) contactsMap.set(item.invoice.contact.id, item.invoice.contact);

  return NextResponse.json({ product, contacts: Array.from(contactsMap.values()) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmProduct.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { name, sku, description, price, unit, taxRate, isActive, imageUrl } = body;
  if (price !== undefined && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) {
    return NextResponse.json({ error: "قیمت معتبر الزامی است" }, { status: 400 });
  }

  const product = await prisma.crmProduct.update({
    where: { id: params.id },
    data: {
      name: name?.trim() || undefined,
      sku: sku !== undefined ? sku : undefined,
      description: description !== undefined ? description : undefined,
      price: price !== undefined ? price : undefined,
      unit: unit !== undefined ? unit : undefined,
      taxRate: typeof taxRate === "number" ? taxRate : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      imageUrl: imageUrl !== undefined ? imageUrl : undefined,
    },
  });
  return NextResponse.json({ product });
}

/** Soft-delete only (isActive: false) — a hard delete would break the history of any invoice/deal that already references this product. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmProduct.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmProduct.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
