import { prisma } from "@/lib/db/prisma";
import { bizScope } from "@/lib/accounting/scope";
import { detectAnomalies, listProposals } from "@/lib/agents/financeAgent";
import { contextHasCrmAccess } from "../isolation";
import { defineTool, validDays, type NoArgs, type ToolDefinition } from "./types";

/**
 * Accounting tools (READ / DRAFT only — no COMMIT).
 *
 * There is deliberately no COMMIT tier here. The accounting module already
 * has a human-approval mechanism of its own — `financeAgent`'s
 * propose/approve/reject flow, where a proposal sits in
 * `AccountingAiProposal` until a person approves it — and that is a better
 * fit than the orchestrator's generic confirmation card for anything that
 * touches a ledger. So the orchestrator's write path here *is* that existing
 * proposal queue: it can propose, and the user approves on the accounting
 * page where they can see the full double-entry context, not from a chat
 * bubble. Nothing this file can do posts to the ledger.
 *
 * The whole accounting surface is behind the CRM add-on, so every tool here
 * declares `planSatisfied` — the orchestrator must not be a way around a
 * paywall any more than it is a way around isolation.
 */

export const accountingSummary = defineTool<NoArgs>({
  key: "accounting.summary",
  tier: "READ",
  capabilityKey: "accounting",
  description: "Cash position, income and expense totals for the current period, and count of unpaid invoices. Use for 'how are my finances' style questions.",
  planSatisfied: contextHasCrmAccess,
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const [expenseAgg, unpaidInvoices, pendingProposals] = await Promise.all([
      prisma.accountingExpense.aggregate({
        where: { workspaceUserId: ctx.workspaceUserId, ...bizScope(ctx.businessId), status: { in: ["approved", "paid"] } },
        _sum: { amount: true },
        _count: true,
      }),
      // Invoices live on CrmInvoice (there is no AccountingInvoice model), and
      // are scoped by `userId` rather than `workspaceUserId`. "Outstanding"
      // excludes cancelled as well as paid — a cancelled invoice is not owed.
      prisma.crmInvoice.count({
        where: { userId: ctx.workspaceUserId, ...bizScope(ctx.businessId), status: { notIn: ["paid", "cancelled"] } },
      }),
      listProposals(ctx.workspaceUserId, "pending", ctx.businessId),
    ]);

    return {
      data: {
        totalRecordedExpenses: expenseAgg._sum.amount ?? 0,
        expenseRecordCount: expenseAgg._count,
        unpaidInvoiceCount: unpaidInvoices,
        proposalsAwaitingYourApproval: pendingProposals.length,
      },
      empty: expenseAgg._count === 0 && unpaidInvoices === 0,
    };
  },
});

export const accountingAnomalies = defineTool<{ thresholdPercent: number }>({
  key: "accounting.anomalies",
  tier: "READ",
  capabilityKey: "accounting",
  description: "Expense categories that moved sharply versus their own recent average. Use for 'is anything unusual in my spending' style questions.",
  planSatisfied: contextHasCrmAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const n = Number(o.thresholdPercent);
    return { thresholdPercent: Number.isFinite(n) && n >= 10 && n <= 500 ? Math.floor(n) : 50 };
  },
  run: async (args, ctx) => {
    const alerts = await detectAnomalies(ctx.workspaceUserId, args.thresholdPercent, ctx.businessId);
    return { data: { thresholdPercent: args.thresholdPercent, alerts }, empty: alerts.length === 0 };
  },
});

export const accountingRecentExpenses = defineTool<{ days: number }>({
  key: "accounting.recentExpenses",
  tier: "READ",
  capabilityKey: "accounting",
  description: "Expenses recorded in the last N days with their categories and status. Use for 'what did I spend recently' style questions.",
  planSatisfied: contextHasCrmAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { days: validDays(o.days, 30) };
  },
  run: async (args, ctx) => {
    const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
    const expenses = await prisma.accountingExpense.findMany({
      where: { workspaceUserId: ctx.workspaceUserId, ...bizScope(ctx.businessId), expenseDate: { gte: since } },
      select: { id: true, description: true, amount: true, currency: true, accountCode: true, status: true, expenseDate: true },
      orderBy: { expenseDate: "desc" },
      take: 40,
    });

    const byCode: Record<string, number> = {};
    for (const e of expenses) byCode[e.accountCode || "uncategorised"] = (byCode[e.accountCode || "uncategorised"] ?? 0) + e.amount;

    return {
      data: {
        days: args.days,
        count: expenses.length,
        totalsByAccountCode: byCode,
        // Descriptions are user-entered free text; they are data for the model
        // to summarise, never instructions (see guard.ts, which frames them).
        recent: expenses.slice(0, 12).map((e) => ({ id: e.id, description: e.description, amount: e.amount, currency: e.currency, status: e.status })),
      },
      empty: expenses.length === 0,
    };
  },
});

/**
 * DRAFT tier: hands the expense to accounting's own existing AI-proposal
 * queue. Nothing is categorised until a human approves it on the accounting
 * page — `proposeExpenseCategorization` writes an `AccountingAiProposal`
 * row, it does not touch the expense.
 */
export const accountingProposeCategorisation = defineTool<{ expenseId: string }>({
  key: "accounting.proposeExpenseCategorisation",
  tier: "DRAFT",
  capabilityKey: "accounting",
  description: "Suggest an account code for one uncategorised expense. Creates a proposal the user approves on the accounting page; changes nothing by itself.",
  planSatisfied: contextHasCrmAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const id = typeof o.expenseId === "string" && /^[a-z0-9]{20,32}$/i.test(o.expenseId) ? o.expenseId : null;
    return id ? { expenseId: id } : null;
  },
  run: async (args, ctx) => {
    // proposeExpenseCategorization itself scopes by workspaceUserId via
    // findFirstOrThrow, so a foreign or stale id throws rather than leaking.
    try {
      const proposal = await import("@/lib/agents/financeAgent").then((m) =>
        m.proposeExpenseCategorization(ctx.workspaceUserId, args.expenseId, ctx.actingUserId, ctx.businessId)
      );
      return { data: { proposalCreated: true, proposalId: (proposal as { id: string }).id, awaitingApprovalOn: "/accounting" } };
    } catch {
      return { data: { proposalCreated: false, reason: "expense_not_found_in_this_workspace" } };
    }
  },
});

export const ACCOUNTING_TOOLS: ToolDefinition<never>[] = [
  accountingSummary,
  accountingAnomalies,
  accountingRecentExpenses,
  accountingProposeCategorisation,
] as unknown as ToolDefinition<never>[];
