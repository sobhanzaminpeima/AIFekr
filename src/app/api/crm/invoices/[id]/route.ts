export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { computeInvoiceTotals, InvoiceItemInput } from "@/lib/repositories/crmInvoiceRepository";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";

const VALID_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const invoice = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
    include: { items: true, contact: true, deal: { select: { id: true, title: true } } },
  });
  if (!invoice) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const existing = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const { status, notes, dueDate, items, discount } = body as {
    status?: string; notes?: string; dueDate?: string | null; items?: InvoiceItemInput[]; discount?: number;
  };
  if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: tri(lang, "وضعیت نامعتبر است", "Invalid status", "Ungültiger Status") }, { status: 400 });

  let itemsUpdate: ReturnType<typeof computeInvoiceTotals> | null = null;
  if (items) {
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: tri(lang, "حداقل یک آیتم فاکتور الزامی است", "At least one invoice item is required", "Mindestens eine Rechnungsposition ist erforderlich") }, { status: 400 });
    try {
      itemsUpdate = computeInvoiceTotals(items);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "آیتم فاکتور نامعتبر است", "Invalid invoice item", "Ungültige Rechnungsposition") }, { status: 400 });
    }
  }

  try {
    // Bumping CrmContact.totalSpent only happens on the draft->paid transition —
    // guarded inside the transaction so a repeated PUT with status:"paid" (or a
    // race between two requests) can't double-count the same invoice.
    let becameSentForLedger = false;
    let becamePaidForLedger = false;
    let ledgerTotal = 0;

    const invoice = await prisma.$transaction(async (tx) => {
      const current = await tx.crmInvoice.findUniqueOrThrow({ where: { id: params.id }, include: { items: true } });
      const becamePaid = status === "paid" && current.status !== "paid";
      const becameSent = status === "sent" && current.status === "draft";

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

      // Ledger posting happens after this transaction commits (postJournalEntry
      // runs its own transaction — Prisma doesn't support nesting interactive
      // transactions), guarded by sourceRef idempotency so a retry of this
      // same PUT can never double-post.
      becameSentForLedger = becameSent;
      becamePaidForLedger = becamePaid;
      ledgerTotal = total;

      return updated;
    });

    // Best-effort: an invoice edit should never fail outright just because
    // ledger posting hit an issue (e.g. a locked fiscal period) — the CRM
    // invoice is already the source of truth for what the customer sees;
    // the ledger gets a chance to catch up next time this route runs, since
    // sourceRef makes a later retry safe. Log so a real problem doesn't go
    // unnoticed, without blocking the invoice update itself.
    if (becameSentForLedger || becamePaidForLedger) {
      await ensureDefaultChartOfAccounts(ws.workspaceUserId).catch(() => {});
    }
    if (becameSentForLedger && ledgerTotal > 0) {
      await postJournalEntry({
        workspaceUserId: ws.workspaceUserId,
        postedBy: "system",
        memo: `Invoice ${invoice.invoiceNumber} issued`,
        sourceRef: `invoice:sent:${params.id}`,
        lines: [
          { accountCode: "1200", debit: ledgerTotal },
          { accountCode: "4000", credit: ledgerTotal },
        ],
      }).catch((e) => console.error("Ledger post (invoice sent) failed:", e));
    }
    if (becamePaidForLedger && ledgerTotal > 0) {
      await postJournalEntry({
        workspaceUserId: ws.workspaceUserId,
        postedBy: "system",
        memo: `Invoice ${invoice.invoiceNumber} paid`,
        sourceRef: `invoice:paid:${params.id}`,
        lines: [
          { accountCode: "1000", debit: ledgerTotal },
          { accountCode: "1200", credit: ledgerTotal },
        ],
      }).catch((e) => console.error("Ledger post (invoice paid) failed:", e));
    }

    return NextResponse.json({ invoice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ویرایش فاکتور", "Failed to update invoice", "Fehler beim Aktualisieren der Rechnung") }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const existing = await prisma.crmInvoice.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.$transaction([
    prisma.crmInvoiceRevision.deleteMany({ where: { invoiceId: params.id } }),
    prisma.crmInvoiceItem.deleteMany({ where: { invoiceId: params.id } }),
    prisma.crmInvoice.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ success: true });
}
