export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { computeInvoiceTotals, InvoiceItemInput } from "@/lib/repositories/crmInvoiceRepository";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

const VALID_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const invoice = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
    include: { items: true, contact: true, deal: { select: { id: true, title: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { status, notes, dueDate, items, discount } = body as {
    status?: string; notes?: string; dueDate?: string | null; items?: InvoiceItemInput[]; discount?: number;
  };
  if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  let itemsUpdate: ReturnType<typeof computeInvoiceTotals> | null = null;
  if (items) {
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "حداقل یک آیتم فاکتور الزامی است" }, { status: 400 });
    try {
      itemsUpdate = computeInvoiceTotals(items);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "آیتم فاکتور نامعتبر است" }, { status: 400 });
    }
  }

  try {
    // Bumping CrmContact.totalSpent only happens on the draft->paid transition —
    // guarded inside the transaction so a repeated PUT with status:"paid" (or a
    // race between two requests) can't double-count the same invoice.
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await tx.crmInvoice.findUniqueOrThrow({ where: { id: params.id }, include: { items: true } });
      const becamePaid = status === "paid" && current.status !== "paid";

      // Editing an already-finalized (not draft) invoice's amounts is allowed,
      // but the pre-edit state is snapshotted first — a customer who already
      // received a copy can't have it silently rewritten with no trace.
      const isFinalized = current.status !== "draft";
      if (isFinalized && (itemsUpdate || discount !== undefined)) {
        await tx.crmInvoiceRevision.create({
          data: { invoiceId: params.id, snapshotJson: JSON.stringify({ ...current, items: current.items }) },
        });
      }

      const discountAmt = discount !== undefined ? Math.max(0, discount) : current.discount;
      const subtotal = itemsUpdate ? itemsUpdate.subtotal : current.subtotal;
      const taxTotal = itemsUpdate ? itemsUpdate.taxTotal : current.taxTotal;
      const total = itemsUpdate || discount !== undefined ? Math.max(0, subtotal + taxTotal - discountAmt) : current.total;

      if (itemsUpdate) {
        await tx.crmInvoiceItem.deleteMany({ where: { invoiceId: params.id } });
        await tx.crmInvoiceItem.createMany({ data: itemsUpdate.itemsData.map((it) => ({ ...it, invoiceId: params.id })) });
      }

      const updated = await tx.crmInvoice.update({
        where: { id: params.id },
        data: {
          status: status || undefined,
          notes: notes !== undefined ? notes : undefined,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
          paidAt: becamePaid ? new Date() : undefined,
          discount: discountAmt,
          subtotal,
          taxTotal,
          total,
        },
        include: { items: true },
      });

      if (becamePaid) {
        // totalSpent is Int; round since invoice totals can carry fractional amounts.
        await tx.crmContact.update({
          where: { id: current.contactId },
          data: { totalSpent: { increment: Math.round(total) } },
        });
      }

      return updated;
    });

    return NextResponse.json({ invoice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا در ویرایش فاکتور" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const existing = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.$transaction([
    prisma.crmInvoiceRevision.deleteMany({ where: { invoiceId: params.id } }),
    prisma.crmInvoiceItem.deleteMany({ where: { invoiceId: params.id } }),
    prisma.crmInvoice.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ success: true });
}
