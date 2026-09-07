import { prisma } from "@/lib/db/prisma";
import { postJournalEntry } from "./ledger";
import { getFxSnapshot, convert } from "./reportingFx";

/** Machine code, not prose -- translated at the API boundary, same pattern as ownerStatement.ts's STATEMENT_LOCKED. */
export const FX_RATE_UNAVAILABLE = "EXPENSE_FX_RATE_UNAVAILABLE";

/**
 * Bills and cash expenses (spec ۳.۳). An expense above the workspace's
 * approval threshold is created as "pending_approval" and cannot post to
 * the ledger until a manager approves it — enforced here, not just hidden
 * in the UI.
 */

// Spec calls for a configurable per-workspace cap ("سقف معین"); a flat
// default keeps Phase B shippable — a per-workspace override can be added
// to SiteSetting/AccountingSettings later without changing this function's
// signature.
const DEFAULT_APPROVAL_THRESHOLD = 5_000_000; // Toman

export interface CreateExpenseInput {
  workspaceUserId: string;
  vendorId?: string;
  /** The unit this cost belongs to. Omitted for agency-level costs like office rent. */
  propertyId?: string;
  kind?: "bill" | "cash_expense";
  accountCode: string;
  amount: number;
  /** Currency `amount` was actually paid in. Defaults to IRT. */
  currency?: string;
  description: string;
  receiptUrl?: string;
  expenseDate?: Date;
  dueDate?: Date;
  approvalThreshold?: number;
}

export async function createExpense(input: CreateExpenseInput) {
  const threshold = input.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;
  const needsApproval = input.amount > threshold;

  return prisma.accountingExpense.create({
    data: {
      workspaceUserId: input.workspaceUserId,
      vendorId: input.vendorId,
      propertyId: input.propertyId,
      kind: input.kind || "cash_expense",
      accountCode: input.accountCode,
      amount: input.amount,
      currency: input.currency || "IRT",
      description: input.description,
      receiptUrl: input.receiptUrl,
      expenseDate: input.expenseDate || new Date(),
      dueDate: input.dueDate,
      status: needsApproval ? "pending_approval" : "approved",
    },
  });
}

export async function approveExpense(expenseId: string, approvedBy: string) {
  const expense = await prisma.accountingExpense.findUniqueOrThrow({ where: { id: expenseId } });
  if (expense.status !== "pending_approval") throw new Error("Only a pending expense can be approved");
  return prisma.accountingExpense.update({
    where: { id: expenseId },
    data: { status: "approved", approvedBy, approvedAt: new Date() },
  });
}

export async function rejectExpense(expenseId: string, rejectedBy: string) {
  const expense = await prisma.accountingExpense.findUniqueOrThrow({ where: { id: expenseId } });
  if (expense.status !== "pending_approval") throw new Error("Only a pending expense can be rejected");
  return prisma.accountingExpense.update({
    where: { id: expenseId },
    data: { status: "rejected", approvedBy: rejectedBy, approvedAt: new Date() },
  });
}

/**
 * Marks an approved expense paid and posts Debit <accountCode> / Credit Cash
 * to the ledger. Idempotent via sourceRef.
 *
 * The ledger itself has always been single-currency (Toman) — every posting
 * anywhere in this module assumes that. So a non-Toman expense (e.g. 3,000
 * TRY paid at a shop for one unit) is converted to IRT at the day's rate
 * ONLY for this posting; `expense.amount`/`expense.currency` on the row
 * itself are never touched, so "what did this actually cost in TRY" stays
 * answerable. If no rate is available, this refuses to post rather than
 * guess — same rule as every other conversion in this module (reportingFx.ts).
 */
export async function payExpense(expenseId: string, paidBy: string) {
  const expense = await prisma.accountingExpense.findUniqueOrThrow({ where: { id: expenseId } });
  if (expense.status !== "approved") throw new Error("Only an approved expense can be paid");

  let ledgerAmount = expense.amount;
  let memo = `Expense: ${expense.description}`;
  if (expense.currency !== "IRT") {
    const snap = await getFxSnapshot();
    const converted = snap ? convert(expense.amount, expense.currency, "IRT", snap) : null;
    if (!converted) throw new Error(FX_RATE_UNAVAILABLE);
    ledgerAmount = Math.round(converted.value);
    memo += ` (${expense.amount.toLocaleString("en-US")} ${expense.currency} at ${converted.rate.toFixed(2)})`;
  }

  await postJournalEntry({
    workspaceUserId: expense.workspaceUserId,
    postedBy: paidBy,
    memo,
    sourceRef: `expense:paid:${expense.id}`,
    lines: [
      { accountCode: expense.accountCode, debit: ledgerAmount },
      { accountCode: "1000", credit: ledgerAmount },
    ],
  });

  return prisma.accountingExpense.update({ where: { id: expenseId }, data: { status: "paid", paidAt: new Date() } });
}
