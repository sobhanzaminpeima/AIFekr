export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const invoice = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: user.id },
    include: { items: true, contact: true, deal: { select: { id: true, title: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmInvoice.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { status, notes, dueDate } = body;
  if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  // Bumping CrmContact.totalSpent only happens on the draft->paid transition —
  // guarded inside the transaction so a repeated PUT with status:"paid" (or a
  // race between two requests) can't double-count the same invoice.
  const invoice = await prisma.$transaction(async (tx) => {
    const current = await tx.crmInvoice.findUniqueOrThrow({ where: { id: params.id } });
    const becamePaid = status === "paid" && current.status !== "paid";

    const updated = await tx.crmInvoice.update({
      where: { id: params.id },
      data: {
        status: status || undefined,
        notes: notes !== undefined ? notes : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        paidAt: becamePaid ? new Date() : undefined,
      },
    });

    if (becamePaid) {
      // totalSpent is Int; round since invoice totals can carry fractional amounts.
      await tx.crmContact.update({
        where: { id: current.contactId },
        data: { totalSpent: { increment: Math.round(current.total) } },
      });
    }

    return updated;
  });

  return NextResponse.json({ invoice });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmInvoice.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.$transaction([
    prisma.crmInvoiceItem.deleteMany({ where: { invoiceId: params.id } }),
    prisma.crmInvoice.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ success: true });
}
