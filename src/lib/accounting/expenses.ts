import { prisma } from "@/lib/db/prisma";
import { postJournalEntry } from "./ledger";

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
  kind?: "bill" | "cash_expense";
  accountCode: string;
  amount: number;
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
      kind: input.kind || "cash_expense",
      accountCode: input.accountCode,
      amount: input.amount,
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

/** Marks an approved expense paid and posts Debit <accountCode> / Credit Cash to the ledger. Idempotent via sourceRef. */
export async function payExpense(expenseId: string, paidBy: string) {
  const expense = await prisma.accountingExpense.findUniqueOrThrow({ where: { id: expenseId } });
  if (expense.status !== "approved") throw new Error("Only an approved expense can be paid");

  await postJournalEntry({
    workspaceUserId: expense.workspaceUserId,
    postedBy: paidBy,
    memo: `Expense: ${expense.description}`,
    sourceRef: `expense:paid:${expense.id}`,
    lines: [
      { accountCode: expense.accountCode, debit: expense.amount },
      { accountCode: "1000", credit: expense.amount },
    ],
  });

  return prisma.accountingExpense.update({ where: { id: expenseId }, data: { status: "paid", paidAt: new Date() } });
}
