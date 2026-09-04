import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { parseBankStatementCsv, importBankTransactions, findMatchCandidates, confirmMatch, ignoreTransaction } from "./bankReconciliation";
import { getVatReport } from "./tax";
import { setBudget, getBudgetVsActual, getCashFlowForecast } from "./budget";
import { postJournalEntry } from "./ledger";
import { payExpense, createExpense, approveExpense } from "./expenses";

const WS = `test-phasec-${Date.now()}`;
let wsUser: { id: string };
let contact: { id: string };
let bankAccount: { id: string };

beforeAll(async () => {
  wsUser = await prisma.user.create({ data: { name: "PhaseC Workspace", email: `phasec-ws-${Date.now()}@test.local`, passwordHash: "x" } });
  await prisma.accountingAccount.createMany({
    data: [
      { workspaceUserId: wsUser.id, code: "1000", name: "Cash", type: "asset" },
      { workspaceUserId: wsUser.id, code: "4000", name: "Revenue", type: "revenue" },
      { workspaceUserId: wsUser.id, code: "5200", name: "Advertising", type: "expense" },
    ],
  });
  contact = await prisma.crmContact.create({ data: { userId: wsUser.id, name: "Test Customer" } });
  bankAccount = await prisma.accountingBankAccount.create({ data: { workspaceUserId: wsUser.id, name: "Test Bank" } });
});

afterAll(async () => {
  const accounts = await prisma.accountingAccount.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entryIds } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.accountingBankTransaction.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingBankAccount.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingBudget.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingExpense.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } });
  await prisma.crmInvoice.deleteMany({ where: { userId: wsUser.id } });
  await prisma.crmContact.delete({ where: { id: contact.id } });
  await prisma.user.delete({ where: { id: wsUser.id } });
});

describe("bank reconciliation — CSV parsing and matching", () => {
  it("parses a CSV bank statement", () => {
    const csv = "date,description,amount\n2026-08-01,Ad spend refund,-150000\n2026-08-05,Customer payment,500000";
    const rows = parseBankStatementCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(-150000);
    expect(rows[1].amount).toBe(500000);
  });

  it("rejects a CSV missing required columns", () => {
    expect(() => parseBankStatementCsv("foo,bar\n1,2")).toThrow();
  });

  it("finds a paid expense as a match candidate for a withdrawal, and confirming it works", async () => {
    const expense = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5200", amount: 200000, description: "Ad campaign" });
    await payExpense(expense.id, "system");

    await importBankTransactions(wsUser.id, bankAccount.id, [{ date: new Date(), description: "Ad campaign payment", amount: -200000 }]);
    const txn = await prisma.accountingBankTransaction.findFirstOrThrow({ where: { bankAccountId: bankAccount.id, status: "unmatched" } });

    const candidates = await findMatchCandidates(wsUser.id, txn.id);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].type).toBe("expense");
    expect(candidates[0].id).toBe(expense.id);

    const matched = await confirmMatch(txn.id, "expense", expense.id, "manager-1");
    expect(matched.status).toBe("matched");
  });

  it("ignoring a transaction marks it ignored, not matched", async () => {
    await importBankTransactions(wsUser.id, bankAccount.id, [{ date: new Date(), description: "Unexplained fee", amount: -5000 }]);
    const txn = await prisma.accountingBankTransaction.findFirstOrThrow({ where: { bankAccountId: bankAccount.id, description: "Unexplained fee" } });
    const ignored = await ignoreTransaction(txn.id, "manager-1");
    expect(ignored.status).toBe("ignored");
  });
});

describe("VAT report", () => {
  it("sums output tax from invoices and input tax from expenses independently", async () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    await prisma.crmInvoice.create({
      data: { userId: wsUser.id, contactId: contact.id, invoiceNumber: `VAT-TEST-${Date.now()}`, status: "sent", issueDate: new Date("2026-06-01"), subtotal: 1000000, taxTotal: 90000, total: 1090000 },
    });
    const expense = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5200", amount: 218000, description: "Taxed expense" });
    await prisma.accountingExpense.update({ where: { id: expense.id }, data: { taxAmount: 18000 } });

    const report = await getVatReport(wsUser.id, from, to);
    expect(report.outputTax).toBeGreaterThanOrEqual(90000);
    expect(report.inputTax).toBeGreaterThanOrEqual(18000);
    expect(report.netPayable).toBe(report.outputTax - report.inputTax);
  });
});

describe("budget vs actual", () => {
  it("computes variance against real ledger activity, not a second set of numbers", async () => {
    const period = new Date();
    await setBudget(wsUser.id, "5200", period, 100000);

    await postJournalEntry({
      workspaceUserId: wsUser.id,
      postedBy: "system",
      lines: [
        { accountCode: "5200", debit: 150000 },
        { accountCode: "1000", credit: 150000 },
      ],
    });

    const rows = await getBudgetVsActual(wsUser.id, period);
    const row = rows.find((r) => r.accountCode === "5200")!;
    expect(row.budgeted).toBe(100000);
    expect(row.actual).toBeGreaterThanOrEqual(150000);
    expect(row.variance).toBe(row.actual - row.budgeted);
  });
});

describe("cash flow forecast", () => {
  it("returns the requested number of months with non-negative figures", async () => {
    const forecast = await getCashFlowForecast(wsUser.id, 3);
    expect(forecast).toHaveLength(3);
    for (const m of forecast) {
      expect(m.expectedInflow).toBeGreaterThanOrEqual(0);
      expect(m.expectedOutflow).toBeGreaterThanOrEqual(0);
    }
  });
});
