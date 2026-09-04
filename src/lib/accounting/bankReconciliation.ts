import { prisma } from "@/lib/db/prisma";
import { parseCsv } from "@/lib/utils/csv";

/**
 * Bank reconciliation (spec ۳.۶). Iran has no widespread Open Banking API,
 * so import is CSV — reusing the dependency-free parser already built for
 * property import rather than pulling in xlsx (see csv.ts for why xlsx is
 * avoided platform-wide: two unpatched high-severity advisories).
 *
 * Matching never creates a ledger entry — it only links an imported bank
 * line to the expense/invoice payment that already explains it. The money
 * was already recorded when the expense was paid or the invoice marked
 * paid; reconciliation just confirms the bank agrees.
 */

export interface ImportedTransaction {
  date: Date;
  description: string;
  amount: number;
}

/** CSV columns: date,description,amount — amount positive for deposits, negative for withdrawals. */
export function parseBankStatementCsv(csvText: string): ImportedTransaction[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const [header, ...body] = rows;
  const dateIdx = header.findIndex((h) => h.trim().toLowerCase() === "date");
  const descIdx = header.findIndex((h) => h.trim().toLowerCase() === "description");
  const amountIdx = header.findIndex((h) => h.trim().toLowerCase() === "amount");
  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error('CSV must have "date", "description", and "amount" columns');
  }
  return body
    .filter((r) => r.length > Math.max(dateIdx, descIdx, amountIdx) && r[dateIdx]?.trim())
    .map((r) => ({ date: new Date(r[dateIdx]), description: r[descIdx], amount: parseFloat(r[amountIdx]) }))
    .filter((t) => !isNaN(t.amount) && !isNaN(t.date.getTime()));
}

export async function importBankTransactions(workspaceUserId: string, bankAccountId: string, transactions: ImportedTransaction[]) {
  const account = await prisma.accountingBankAccount.findFirst({ where: { id: bankAccountId, workspaceUserId } });
  if (!account) throw new Error("Bank account not found");

  await prisma.accountingBankTransaction.createMany({
    data: transactions.map((t) => ({ workspaceUserId, bankAccountId, date: t.date, description: t.description, amount: t.amount })),
  });
  return prisma.accountingBankTransaction.count({ where: { bankAccountId, status: "unmatched" } });
}

// Levenshtein distance — small and dependency-free, same philosophy as the
// hand-written CSV parser: no new package for something this size.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function descriptionSimilarity(a: string, b: string): number {
  const an = a.toLowerCase().trim();
  const bn = b.toLowerCase().trim();
  if (!an || !bn) return 0;
  const dist = levenshtein(an, bn);
  return 1 - dist / Math.max(an.length, bn.length);
}

export interface MatchCandidate {
  type: "expense" | "invoice";
  id: string;
  description: string;
  amount: number;
  date: Date;
  /** 0–1, higher is a better match. */
  confidence: number;
}

const AMOUNT_TOLERANCE = 1; // Toman — float rounding only, not a real fuzzy amount match
const DATE_WINDOW_DAYS = 5;

/** Finds candidate expense/invoice payments that could explain one unmatched bank transaction, ranked by confidence. */
export async function findMatchCandidates(workspaceUserId: string, transactionId: string): Promise<MatchCandidate[]> {
  const txn = await prisma.accountingBankTransaction.findUniqueOrThrow({ where: { id: transactionId } });
  if (txn.workspaceUserId !== workspaceUserId) throw new Error("Not found");

  const windowStart = new Date(txn.date.getTime() - DATE_WINDOW_DAYS * 86400000);
  const windowEnd = new Date(txn.date.getTime() + DATE_WINDOW_DAYS * 86400000);
  const absAmount = Math.abs(txn.amount);

  const candidates: MatchCandidate[] = [];

  if (txn.amount < 0) {
    // A withdrawal — look for a paid expense in the same amount/date window.
    const expenses = await prisma.accountingExpense.findMany({
      where: { workspaceUserId, status: "paid", paidAt: { gte: windowStart, lte: windowEnd }, amount: { gte: absAmount - AMOUNT_TOLERANCE, lte: absAmount + AMOUNT_TOLERANCE } },
    });
    for (const e of expenses) {
      const dateScore = 1 - Math.abs((e.paidAt!.getTime() - txn.date.getTime()) / (DATE_WINDOW_DAYS * 86400000));
      const descScore = descriptionSimilarity(e.description, txn.description);
      candidates.push({ type: "expense", id: e.id, description: e.description, amount: -e.amount, date: e.paidAt!, confidence: 0.5 * dateScore + 0.3 + 0.2 * descScore });
    }
  } else {
    // A deposit — look for a paid invoice in the same amount/date window.
    const invoices = await prisma.crmInvoice.findMany({
      where: { userId: workspaceUserId, status: "paid", paidAt: { gte: windowStart, lte: windowEnd }, total: { gte: absAmount - AMOUNT_TOLERANCE, lte: absAmount + AMOUNT_TOLERANCE } },
      include: { contact: { select: { name: true } } },
    });
    for (const inv of invoices) {
      const dateScore = 1 - Math.abs((inv.paidAt!.getTime() - txn.date.getTime()) / (DATE_WINDOW_DAYS * 86400000));
      const descScore = descriptionSimilarity(inv.contact.name, txn.description);
      candidates.push({ type: "invoice", id: inv.id, description: `${inv.invoiceNumber} — ${inv.contact.name}`, amount: inv.total, date: inv.paidAt!, confidence: 0.5 * dateScore + 0.3 + 0.2 * descScore });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/** Confirms a match — the final decision is always the user's (spec ۸.۵-equivalent for finance: AI/algorithm proposes, human decides). */
export async function confirmMatch(transactionId: string, matchedType: "expense" | "invoice", matchedId: string, matchedBy: string) {
  return prisma.accountingBankTransaction.update({
    where: { id: transactionId },
    data: { status: "matched", matchedType, matchedId, matchedAt: new Date(), matchedBy },
  });
}

export async function ignoreTransaction(transactionId: string, by: string) {
  return prisma.accountingBankTransaction.update({ where: { id: transactionId }, data: { status: "ignored", matchedBy: by, matchedAt: new Date() } });
}
