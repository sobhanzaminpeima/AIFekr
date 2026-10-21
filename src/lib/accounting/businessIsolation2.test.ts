import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultChartOfAccounts } from "./chartOfAccounts";
import { postJournalEntry, BusinessRequiredError } from "./ledger";
import { createExpense, payExpense } from "./expenses";
import { upsertEmployee, generatePayrollRun, approvePayrollRun, payPayrollRun } from "./payroll";
import { importBankTransactions, confirmMatch } from "./bankReconciliation";
import { createApiToken, verifyApiTokenScope, getBiExport } from "./biApi";
import { proposeJournalEntry, approveProposal, listProposals } from "@/lib/agents/financeAgent";

/**
 * Second half of the multi-business accounting isolation suite: the write
 * paths that post to the ledger, the bank-matching IDOR, external BI tokens
 * and AI proposals. Same rule as businessIsolation.test.ts -- one workspace
 * owner, two businesses, and nothing may cross between them.
 */
const P = `acctiso2${Date.now().toString(36)}`;
const wsUserId = `${P}ws`;
const otherTenantId = `${P}other`;
const bizA = `${P}bizA`;
const bizB = `${P}bizB`;

async function balanceOf(businessId: string, code: string): Promise<number> {
  const acct = await prisma.accountingAccount.findFirst({ where: { workspaceUserId: wsUserId, businessId, code } });
  if (!acct) throw new Error("no account " + code);
  const agg = await prisma.accountingJournalEntryLine.aggregate({ where: { accountId: acct.id }, _sum: { debit: true, credit: true } });
  return (agg._sum.debit || 0) - (agg._sum.credit || 0);
}

beforeAll(async () => {
  await prisma.user.createMany({ data: [{ id: wsUserId, name: "ws" }, { id: otherTenantId, name: "other" }] });
  await ensureDefaultChartOfAccounts(wsUserId, bizA);
  await ensureDefaultChartOfAccounts(wsUserId, bizB);
  await ensureDefaultChartOfAccounts(otherTenantId, `${P}otherBiz`);
}, 60_000);

afterAll(async () => {
  const ids = [wsUserId, otherTenantId];
  await prisma.accountingBankTransaction.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingBankAccount.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingPayslip.deleteMany({ where: { payrollRun: { workspaceUserId: { in: ids } } } });
  await prisma.accountingPayrollRun.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingEmployee.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingExpense.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingAiProposal.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingApiToken.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entry: { workspaceUserId: { in: ids } } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingAccount.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [`${P}mgr`, wsUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("ledger refuses to guess", () => {
  it("rejects an entry with no business in a workspace that runs several (would otherwise cross-post)", async () => {
    await expect(
      postJournalEntry({ workspaceUserId: wsUserId, postedBy: `${P}mgr`, memo: "ambiguous", lines: [{ accountCode: "1000", debit: 10 }, { accountCode: "4000", credit: 10 }] }),
    ).rejects.toBeInstanceOf(BusinessRequiredError);
  });

  it("still accepts an entry with no business in a single-business workspace (legacy callers keep working) and stamps it", async () => {
    const soleBiz = `${P}otherBiz`;
    const entry = await postJournalEntry({ workspaceUserId: otherTenantId, postedBy: `${P}mgr`, memo: "legacy", lines: [{ accountCode: "1000", debit: 5 }, { accountCode: "4000", credit: 5 }] });
    expect(entry.businessId).toBe(soleBiz);
  });
});

describe("expense payment", () => {
  // approvalThreshold is set above every amount below, so createExpense() auto-approves these (no separate approve step).
  it("posts into the expense's own business only", async () => {
    const before = { a: await balanceOf(bizA, "1000"), b: await balanceOf(bizB, "1000") };
    const exp = await createExpense({ workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100", amount: 700, description: "B-only cost", approvalThreshold: 1_000_000 });
    await payExpense(exp.id, `${P}mgr`);

    expect(await balanceOf(bizB, "1000")).toBe(before.b - 700); // cash credited
    expect(await balanceOf(bizA, "1000")).toBe(before.a); // A untouched
  });

  it("refuses to pay an expense through another business's scope (IDOR)", async () => {
    const exp = await createExpense({ workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100", amount: 50, description: "guard", approvalThreshold: 1_000_000 });
    await expect(payExpense(exp.id, `${P}mgr`, { workspaceUserId: wsUserId, businessId: bizA })).rejects.toThrow(/not found/i);
  });
});

describe("payroll", () => {
  it("runs, approves and pays per business, posting to that business's ledger", async () => {
    await upsertEmployee({ workspaceUserId: wsUserId, businessId: bizA, name: "Ali", baseSalary: 1000 });
    await upsertEmployee({ workspaceUserId: wsUserId, businessId: bizB, name: "Bea", baseSalary: 4000 });
    const month = new Date(Date.UTC(2032, 3, 1));

    const runA = await generatePayrollRun(wsUserId, month, bizA);
    const runB = await generatePayrollRun(wsUserId, month, bizB); // same month: must NOT collide with A's run
    expect(runA.id).not.toBe(runB.id);
    expect(runA.payslips).toHaveLength(1);
    expect(runB.payslips[0].baseSalary).toBe(4000);

    const beforeB = await balanceOf(bizB, "5000");
    await approvePayrollRun(runB.id, `${P}mgr`, { workspaceUserId: wsUserId, businessId: bizB });
    await payPayrollRun(runB.id, `${P}mgr`, { workspaceUserId: wsUserId, businessId: bizB });
    expect(await balanceOf(bizB, "5000")).toBe(beforeB + 4000);
    expect(await balanceOf(bizA, "5000")).toBe(0);
  });

  it("refuses to approve another business's run", async () => {
    const run = await prisma.accountingPayrollRun.findFirstOrThrow({ where: { workspaceUserId: wsUserId, businessId: bizA } });
    await expect(approvePayrollRun(run.id, `${P}mgr`, { workspaceUserId: wsUserId, businessId: bizB })).rejects.toThrow(/not found/i);
  });
});

describe("bank reconciliation", () => {
  it("will not link a bank line to a record from another business or another tenant", async () => {
    const acct = await prisma.accountingBankAccount.create({ data: { workspaceUserId: wsUserId, businessId: bizA, name: "A bank" } });
    await importBankTransactions(wsUserId, acct.id, [{ date: new Date(), description: "x", amount: -100 }], bizA);
    const txn = await prisma.accountingBankTransaction.findFirstOrThrow({ where: { bankAccountId: acct.id } });
    expect(txn.businessId).toBe(bizA);

    const foreign = await createExpense({ workspaceUserId: otherTenantId, businessId: `${P}otherBiz`, accountCode: "5100", amount: 100, description: "someone else", approvalThreshold: 1_000_000 });
    const sibling = await createExpense({ workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100", amount: 100, description: "sibling business", approvalThreshold: 1_000_000 });
    const scope = { workspaceUserId: wsUserId, businessId: bizA };

    await expect(confirmMatch(txn.id, "expense", foreign.id, `${P}mgr`, scope)).rejects.toThrow(/not found/i);
    await expect(confirmMatch(txn.id, "expense", sibling.id, `${P}mgr`, scope)).rejects.toThrow(/not found/i);

    const own = await createExpense({ workspaceUserId: wsUserId, businessId: bizA, accountCode: "5100", amount: 100, description: "mine", approvalThreshold: 1_000_000 });
    await expect(confirmMatch(txn.id, "expense", own.id, `${P}mgr`, scope)).resolves.toBeTruthy();
  });
});

describe("external BI token", () => {
  it("only exposes the business it was issued for", async () => {
    // Give each business a distinguishable expense so the counts tell them apart.
    await createExpense({ workspaceUserId: wsUserId, businessId: bizA, accountCode: "5100", amount: 1, description: "a1", expenseDate: new Date(2033, 0, 10), approvalThreshold: 1_000_000 });
    await createExpense({ workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100", amount: 1, description: "b1", expenseDate: new Date(2033, 0, 10), approvalThreshold: 1_000_000 });
    await createExpense({ workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100", amount: 1, description: "b2", expenseDate: new Date(2033, 0, 11), approvalThreshold: 1_000_000 });

    const { token } = await createApiToken(wsUserId, "BI for A", bizA);
    const scope = await verifyApiTokenScope(token);
    expect(scope).toEqual({ workspaceUserId: wsUserId, businessId: bizA });

    const data = await getBiExport(scope!.workspaceUserId, new Date(2033, 0, 1), new Date(2033, 0, 31), scope!.businessId);
    expect(data.expenseCount).toBe(1); // A's only -- not B's two
  });
});

describe("AI proposals", () => {
  it("keeps a pending proposal invisible to, and unapprovable by, the other business", async () => {
    const proposal = await proposeJournalEntry({
      workspaceUserId: wsUserId, businessId: bizA, requestedBy: `${P}mgr`, memo: "A adjustment",
      lines: [{ accountCode: "1000", debit: 25 }, { accountCode: "4000", credit: 25 }],
    });

    expect((await listProposals(wsUserId, "pending", bizA)).map((p) => p.id)).toContain(proposal.id);
    expect((await listProposals(wsUserId, "pending", bizB)).map((p) => p.id)).not.toContain(proposal.id);
    await expect(approveProposal(proposal.id, wsUserId, `${P}mgr`, bizB)).rejects.toThrow();

    // Approving from the owning business posts into THAT business's books.
    const before = await balanceOf(bizA, "1000");
    await approveProposal(proposal.id, wsUserId, `${P}mgr`, bizA);
    expect(await balanceOf(bizA, "1000")).toBe(before + 25);
  });
});
