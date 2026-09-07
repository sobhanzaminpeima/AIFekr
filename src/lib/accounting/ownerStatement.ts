import { prisma } from "@/lib/db/prisma";
import { postJournalEntry, reverseJournalEntry } from "./ledger";
import { sendEmail } from "@/lib/email/resend";
import { randomBytes } from "node:crypto";

/**
 * Short-term rental owner statements (spec ۳.۹) — one per property per
 * month. Lifecycle is Draft-and-Approve, per the project's general rule for
 * anything that goes out to a customer/owner: generate (draft, numbers
 * frozen) → approve (posts the ledger entry) → send (emails the owner).
 * Never auto-sends without the approve step.
 */

export interface OwnerStatementEntryInput {
  date: Date;
  description: string;
  category: "guest_stay" | "maintenance" | "utilities" | "consumables" | "other";
  income?: number;
  expense?: number;
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Creates (or replaces, if still in draft) the statement for a property/month
 * from a list of line items — computing income/expense totals and the
 * net-profit / management-fee / owner-share three-row summary exactly per
 * the spec's formulas. Numbers are frozen into the statement row at this
 * point; editing entries after generation requires calling this again
 * (only while status is still "draft" — an approved statement is immutable).
 */
/** Thrown when a statement is past draft. Callers translate this at the API edge. */
export const STATEMENT_LOCKED = "OWNER_STATEMENT_LOCKED";

export async function generateOwnerStatement(
  workspaceUserId: string,
  propertyId: string,
  month: Date,
  entries: OwnerStatementEntryInput[],
  currency: string = "IRT"
) {
  const monthDate = monthStart(month);

  const existing = await prisma.accountingOwnerStatement.findUnique({
    where: { propertyId_month: { propertyId, month: monthDate } },
  });
  if (existing && existing.status !== "draft") {
    // A machine code, not prose: this string used to surface verbatim to the
    // user, in English, naming an internal function they cannot call. The API
    // boundary turns it into a sentence in their language.
    throw new Error(STATEMENT_LOCKED);
  }

  const feeRule =
    (await prisma.accountingManagementFeeRule.findUnique({ where: { propertyId } })) ||
    (await prisma.accountingManagementFeeRule.findFirst({ where: { workspaceUserId, propertyId: null } }));
  const feePercent = feeRule?.feePercent ?? 20;

  const incomeTotal = entries.reduce((s, e) => s + (e.income || 0), 0);
  const expenseTotal = entries.reduce((s, e) => s + (e.expense || 0), 0);
  const netProfit = incomeTotal - expenseTotal;
  const managementFee = Math.max(0, Math.round((netProfit * feePercent) / 100));
  const ownerShare = netProfit - managementFee;

  const data = {
    workspaceUserId,
    propertyId,
    month: monthDate,
    currency,
    incomeTotal,
    expenseTotal,
    netProfit,
    managementFee,
    ownerShare,
    status: "draft" as const,
  };

  if (existing) {
    await prisma.accountingOwnerStatementEntry.deleteMany({ where: { statementId: existing.id } });
    return prisma.accountingOwnerStatement.update({
      where: { id: existing.id },
      data: { ...data, entries: { create: entries.map((e) => ({ date: e.date, description: e.description, category: e.category, income: e.income || 0, expense: e.expense || 0 })) } },
      include: { entries: true },
    });
  }

  return prisma.accountingOwnerStatement.create({
    data: { ...data, entries: { create: entries.map((e) => ({ date: e.date, description: e.description, category: e.category, income: e.income || 0, expense: e.expense || 0 })) } },
    include: { entries: true },
  });
}

/**
 * Approves a draft statement and posts its ledger entry in one shot:
 *   Debit  1000 (Cash)                        = netProfit (income − expenses, net cash actually collected)
 *   Credit 4100 (Management Fee Revenue)      = managementFee
 *   Credit 2200 (Owner Payable)                = ownerShare
 * Balances exactly because ownerShare = netProfit − managementFee by
 * construction (see generateOwnerStatement). Idempotent via sourceRef —
 * approving twice is a no-op on the ledger.
 */
export async function approveOwnerStatement(statementId: string, approvedBy: string) {
  const statement = await prisma.accountingOwnerStatement.findUniqueOrThrow({ where: { id: statementId } });
  if (statement.status !== "draft") throw new Error("Only a draft statement can be approved");
  if (statement.netProfit <= 0) {
    // A loss month still gets approved (owner needs to see it), it just
    // posts no ledger entry — there is nothing to distribute or take a fee from.
    return prisma.accountingOwnerStatement.update({
      where: { id: statementId },
      data: { status: "approved", approvedBy, approvedAt: new Date() },
    });
  }

  await postJournalEntry({
    workspaceUserId: statement.workspaceUserId,
    postedBy: approvedBy,
    memo: `Owner statement ${statement.propertyId} ${statement.month.toISOString().slice(0, 7)}`,
    sourceRef: `owner_statement:approved:${statement.id}`,
    lines: [
      { accountCode: "1000", debit: statement.netProfit },
      { accountCode: "4100", credit: statement.managementFee },
      { accountCode: "2200", credit: statement.ownerShare },
    ].filter((l) => (l.debit || l.credit || 0) > 0),
  });

  return prisma.accountingOwnerStatement.update({
    where: { id: statementId },
    data: { status: "approved", approvedBy, approvedAt: new Date() },
  });
}

/**
 * Emails the owner an HTML summary of an approved statement, WITH a link to a
 * page they can reopen any time without a platform account.
 *
 * Before this, "send to owner" was email-only: the figures lived in the email
 * body and nowhere else, so the owner had no page to return to, forward, or
 * open on a phone without searching their inbox. `shareToken` is generated
 * once on first send (or reused on a resend) and never changes, so the same
 * link keeps working for corrections made through reopenOwnerStatement.
 *
 * Never auto-called by approve — a separate explicit step.
 */
export async function sendOwnerStatement(statementId: string, ownerEmail: string, ownerName: string, lang: "fa" | "en" | "de" = "fa") {
  const statement = await prisma.accountingOwnerStatement.findUniqueOrThrow({
    where: { id: statementId },
    include: { entries: true, property: { select: { title: true } } },
  });
  if (statement.status !== "approved") throw new Error("Only an approved statement can be sent");

  const shareToken = statement.shareToken || randomBytes(20).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  const shareUrl = `${appUrl}/o/${shareToken}`;

  const numLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const monthLabel = statement.month.toLocaleDateString(numLocale, { year: "numeric", month: "long" });
  const rows = statement.entries
    .map((e) => `<tr><td style="padding:6px;border-bottom:1px solid #eee;">${new Date(e.date).toLocaleDateString(numLocale)}</td><td style="padding:6px;border-bottom:1px solid #eee;">${e.description}</td><td style="padding:6px;border-bottom:1px solid #eee;color:#16a34a;">${e.income ? e.income.toLocaleString(numLocale) : ""}</td><td style="padding:6px;border-bottom:1px solid #eee;color:#dc2626;">${e.expense ? e.expense.toLocaleString(numLocale) : ""}</td></tr>`)
    .join("");

  const L = lang === "fa"
    ? { subject: `گزارش تسویه ${statement.property.title} — ${monthLabel}`, hi: "سلام", date: "تاریخ", desc: "توضیح", income: "درآمد", expense: "هزینه", net: "سود خالص", fee: "کارمزد مدیریت", share: "سهم مالک", cta: "مشاهدهٔ آنلاین گزارش", loginCta: "ورود به پنل مالک برای دیدن همهٔ گزارش‌ها" }
    : lang === "de"
    ? { subject: `Eigentümerabrechnung ${statement.property.title} — ${monthLabel}`, hi: "Hallo", date: "Datum", desc: "Beschreibung", income: "Einnahmen", expense: "Ausgaben", net: "Nettogewinn", fee: "Verwaltungsgebühr", share: "Anteil des Eigentümers", cta: "Abrechnung online ansehen", loginCta: "Zum Eigentümerportal für alle Abrechnungen" }
    : { subject: `Owner Statement — ${statement.property.title} — ${monthLabel}`, hi: "Hi", date: "Date", desc: "Description", income: "Income", expense: "Expense", net: "Net Profit", fee: "Management Fee", share: "Owner Share", cta: "View the statement online", loginCta: "Open the owner portal to see every statement" };

  const dir = lang === "fa" ? "rtl" : "ltr";
  const html = `
    <div dir="${dir}" style="font-family:Tahoma,Arial;padding:24px;">
      <h2>${statement.property.title} — ${monthLabel}</h2>
      <p>${L.hi} ${ownerName},</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead><tr><th style="text-align:${dir === "rtl" ? "right" : "left"};padding:6px;">${L.date}</th><th style="text-align:${dir === "rtl" ? "right" : "left"};padding:6px;">${L.desc}</th><th style="text-align:${dir === "rtl" ? "right" : "left"};padding:6px;">${L.income}</th><th style="text-align:${dir === "rtl" ? "right" : "left"};padding:6px;">${L.expense}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="margin-top:16px;">
        <tr><td style="padding:4px 12px;color:#666;">${L.net}</td><td style="padding:4px 12px;font-weight:bold;">${statement.netProfit.toLocaleString(numLocale)} ${statement.currency}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${L.fee}</td><td style="padding:4px 12px;">${statement.managementFee.toLocaleString(numLocale)} ${statement.currency}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${L.share}</td><td style="padding:4px 12px;font-weight:bold;color:#ea580c;">${statement.ownerShare.toLocaleString(numLocale)} ${statement.currency}</td></tr>
      </table>
      <p style="margin-top:24px;">
        <a href="${shareUrl}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;border-radius:8px;text-decoration:none;">${L.cta}</a>
      </p>
      <p style="margin-top:12px;">
        <a href="${appUrl}/api/owner/session-from-share?token=${shareToken}" style="color:#ea580c;font-size:13px;text-decoration:underline;">${L.loginCta}</a>
      </p>
    </div>`;

  const sent = await sendEmail(ownerEmail, L.subject, html);
  if (!sent) throw new Error("Failed to send owner statement email");

  return prisma.accountingOwnerStatement.update({
    where: { id: statementId },
    data: { status: "sent", sentAt: new Date(), shareToken },
  });
}

/**
 * Reopens an approved/sent statement for correction — the manual path
 * generateOwnerStatement()'s own error message points to ("این گزارش قبلاً
 * تأییدشده/ارسال‌شده — قابل بازتولید نیست. اگر نیاز است، یک اصلاح دستی ثبت
 * کنید"), which never existed as real code until now. If the statement's
 * ledger entry was posted (approve step), it is reversed first — the
 * original posting is never mutated or deleted, only reversed, same
 * immutability rule as every other correction in this module. The
 * statement itself resets to "draft" (numbers un-frozen, approvedBy/
 * approvedAt/sentAt cleared) so generateOwnerStatement() can recompute it
 * -- e.g. after a management-fee-percent change -- exactly like a fresh
 * draft. Always explicit and always audit-logged, same rule as fiscal
 * period reopening.
 */
export async function reopenOwnerStatement(statementId: string, workspaceUserId: string, reopenedBy: string) {
  const statement = await prisma.accountingOwnerStatement.findFirstOrThrow({ where: { id: statementId, workspaceUserId } });
  if (statement.status === "draft") throw new Error("This statement is already a draft");

  const postedEntry = await prisma.accountingJournalEntry.findUnique({ where: { sourceRef: `owner_statement:approved:${statement.id}` } });
  if (postedEntry && !postedEntry.isReversed) {
    await reverseJournalEntry(postedEntry.id, reopenedBy, `Reopened owner statement ${statement.id} for correction`);
  }

  const updated = await prisma.accountingOwnerStatement.update({
    where: { id: statementId },
    data: { status: "draft", approvedBy: null, approvedAt: null, sentAt: null },
  });

  await prisma.auditLog.create({
    data: { actorId: reopenedBy, action: "owner_statement_reopened", targetId: statementId, metadata: JSON.stringify({ workspaceUserId, previousStatus: statement.status }) },
  }).catch(() => {});

  return updated;
}
