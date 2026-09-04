import { prisma } from "@/lib/db/prisma";

/** Budgeting and a simple cash-flow forecast (spec ۳.۸). */

export interface BudgetVsActualRow {
  accountCode: string;
  accountName: string;
  budgeted: number;
  actual: number;
  variance: number; // actual - budgeted (negative = under budget for an expense account, which is good)
  variancePercent: number;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function setBudget(workspaceUserId: string, accountCode: string, period: Date, amount: number) {
  const periodDate = monthStart(period);
  return prisma.accountingBudget.upsert({
    where: { workspaceUserId_accountCode_period: { workspaceUserId, accountCode, period: periodDate } },
    update: { amount },
    create: { workspaceUserId, accountCode, period: periodDate, amount },
  });
}

/** Budget vs Actual for one month — actual comes from real ledger lines, never a second set of numbers. */
export async function getBudgetVsActual(workspaceUserId: string, period: Date): Promise<BudgetVsActualRow[]> {
  const periodDate = monthStart(period);
  const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0, 23, 59, 59);

  const budgets = await prisma.accountingBudget.findMany({ where: { workspaceUserId, period: periodDate } });
  const rows: BudgetVsActualRow[] = [];

  for (const budget of budgets) {
    const account = await prisma.accountingAccount.findFirst({ where: { workspaceUserId, code: budget.accountCode } });
    if (!account) continue;

    const agg = await prisma.accountingJournalEntryLine.aggregate({
      where: { accountId: account.id, entry: { entryDate: { gte: periodDate, lte: periodEnd } } },
      _sum: { debit: true, credit: true },
    });
    const isExpenseLike = account.type === "expense" || account.type === "asset";
    const actual = isExpenseLike ? (agg._sum.debit || 0) - (agg._sum.credit || 0) : (agg._sum.credit || 0) - (agg._sum.debit || 0);
    const variance = actual - budget.amount;
    rows.push({
      accountCode: budget.accountCode,
      accountName: account.name,
      budgeted: budget.amount,
      actual,
      variance,
      variancePercent: budget.amount !== 0 ? (variance / budget.amount) * 100 : 0,
    });
  }
  return rows;
}

export interface CashFlowForecastMonth {
  month: string; // YYYY-MM
  expectedInflow: number; // from open invoices due that month
  expectedOutflow: number; // average of the last 3 months' actual expense, as a simple heuristic
}

/**
 * A simple, honestly-heuristic forecast: expected inflow is the sum of
 * currently-open invoices due in each of the next N months; expected
 * outflow is the trailing-3-month average expense, repeated forward. Spec
 * asks for a cash-flow forecast "based on known due invoices and
 * historical payment pattern" — this is a straightforward version of that,
 * not a trained model.
 */
export async function getCashFlowForecast(workspaceUserId: string, monthsAhead: number = 3): Promise<CashFlowForecastMonth[]> {
  const now = new Date();

  const last3MonthsStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const expenseAgg = await prisma.accountingExpense.aggregate({
    where: { workspaceUserId, status: "paid", paidAt: { gte: last3MonthsStart, lte: now } },
    _sum: { amount: true },
  });
  const avgMonthlyOutflow = (expenseAgg._sum.amount || 0) / 3;

  const openInvoices = await prisma.crmInvoice.findMany({
    where: { userId: workspaceUserId, status: { in: ["sent", "overdue"] } },
    select: { total: true, dueDate: true },
  });

  const forecast: CashFlowForecastMonth[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59);
    const inflow = openInvoices
      .filter((inv) => inv.dueDate && inv.dueDate >= monthDate && inv.dueDate <= monthEnd)
      .reduce((s, inv) => s + inv.total, 0);
    forecast.push({ month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`, expectedInflow: inflow, expectedOutflow: avgMonthlyOutflow });
  }
  return forecast;
}
