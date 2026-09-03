import { prisma } from "@/lib/db/prisma";

/**
 * Read-only reports over the ledger. Deliberately just queries/aggregates —
 * per the spec's "no number is ever cached wrong" principle, there is no
 * separate report table that could drift from the journal.
 */

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nameEn: string | null;
  type: string;
  debitTotal: number;
  creditTotal: number;
  /** debitTotal - creditTotal for asset/expense accounts, the reverse for liability/equity/revenue — i.e. each account's natural-side balance. */
  balance: number;
}

const CREDIT_NATURAL_TYPES = new Set(["liability", "equity", "revenue"]);

/** Trial balance as of `asOf` (defaults to now) — every account with any posted activity, plus its net balance. */
export async function getTrialBalance(workspaceUserId: string, asOf: Date = new Date()): Promise<TrialBalanceRow[]> {
  const accounts = await prisma.accountingAccount.findMany({
    where: { workspaceUserId },
    orderBy: { code: "asc" },
  });

  const rows: TrialBalanceRow[] = [];
  for (const account of accounts) {
    const agg = await prisma.accountingJournalEntryLine.aggregate({
      where: { accountId: account.id, entry: { entryDate: { lte: asOf } } },
      _sum: { debit: true, credit: true },
    });
    const debitTotal = agg._sum.debit || 0;
    const creditTotal = agg._sum.credit || 0;
    if (debitTotal === 0 && creditTotal === 0) continue;

    const balance = CREDIT_NATURAL_TYPES.has(account.type) ? creditTotal - debitTotal : debitTotal - creditTotal;
    rows.push({ accountId: account.id, code: account.code, name: account.name, nameEn: account.nameEn, type: account.type, debitTotal, creditTotal, balance });
  }
  return rows;
}

export interface ProfitAndLossResult {
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
  revenueByAccount: { code: string; name: string; nameEn: string | null; amount: number }[];
  expenseByAccount: { code: string; name: string; nameEn: string | null; amount: number }[];
}

/** Basic P&L for [from, to] — revenue accounts' credit balance minus expense accounts' debit balance. */
export async function getProfitAndLoss(workspaceUserId: string, from: Date, to: Date): Promise<ProfitAndLossResult> {
  const accounts = await prisma.accountingAccount.findMany({
    where: { workspaceUserId, type: { in: ["revenue", "expense"] } },
  });

  const revenueByAccount: ProfitAndLossResult["revenueByAccount"] = [];
  const expenseByAccount: ProfitAndLossResult["expenseByAccount"] = [];
  let revenueTotal = 0;
  let expenseTotal = 0;

  for (const account of accounts) {
    const agg = await prisma.accountingJournalEntryLine.aggregate({
      where: { accountId: account.id, entry: { entryDate: { gte: from, lte: to } } },
      _sum: { debit: true, credit: true },
    });
    const debitTotal = agg._sum.debit || 0;
    const creditTotal = agg._sum.credit || 0;

    if (account.type === "revenue") {
      const amount = creditTotal - debitTotal;
      if (amount !== 0) {
        revenueByAccount.push({ code: account.code, name: account.name, nameEn: account.nameEn, amount });
        revenueTotal += amount;
      }
    } else {
      const amount = debitTotal - creditTotal;
      if (amount !== 0) {
        expenseByAccount.push({ code: account.code, name: account.name, nameEn: account.nameEn, amount });
        expenseTotal += amount;
      }
    }
  }

  return { revenueTotal, expenseTotal, netProfit: revenueTotal - expenseTotal, revenueByAccount, expenseByAccount };
}
