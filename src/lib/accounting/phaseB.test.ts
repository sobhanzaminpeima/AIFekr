import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { payExpense, createExpense, approveExpense } from "./expenses";
import { createCommissionRecord, payCommissionSplit } from "./commission";
import { generateOwnerStatement, approveOwnerStatement } from "./ownerStatement";
import { getTrialBalance } from "./reports";

// Integration tests against the real dev DB, same convention as ledger.test.ts.
// Unlike AccountingAccount (no FK to User), CrmContact/CrmPipeline/CrmDeal/
// Property all have real foreign keys to User — so the workspace here has
// to be a genuine User row, not a bare id string.
let wsUser: { id: string };
let userA: { id: string };
let userB: { id: string };
let contact: { id: string };
let pipeline: { id: string };
let stage: { id: string };
let deal: { id: string };
let property: { id: string };

async function seedAccounts(workspaceUserId: string) {
  await prisma.accountingAccount.createMany({
    data: [
      { workspaceUserId, code: "1000", name: "Cash", type: "asset" },
      { workspaceUserId, code: "1200", name: "Receivable", type: "asset" },
      { workspaceUserId, code: "2200", name: "Owner Payable", type: "liability" },
      { workspaceUserId, code: "4100", name: "Management Fee Revenue", type: "revenue" },
      { workspaceUserId, code: "5000", name: "Agent Commission", type: "expense" },
      { workspaceUserId, code: "5200", name: "Advertising", type: "expense" },
    ],
  });
}

beforeAll(async () => {
  wsUser = await prisma.user.create({ data: { name: "PhaseB Workspace", email: `phaseb-ws-${Date.now()}@test.local`, passwordHash: "x" } });
  userA = await prisma.user.create({ data: { name: "PhaseB Agent A", email: `phaseb-a-${Date.now()}@test.local`, passwordHash: "x" } });
  userB = await prisma.user.create({ data: { name: "PhaseB Agent B", email: `phaseb-b-${Date.now()}@test.local`, passwordHash: "x" } });
  await seedAccounts(wsUser.id);
  contact = await prisma.crmContact.create({ data: { userId: wsUser.id, name: "Test Owner" } });
  pipeline = await prisma.crmPipeline.create({ data: { userId: wsUser.id, name: "Test Pipeline" } });
  stage = await prisma.crmStage.create({ data: { pipelineId: pipeline.id, name: "Won", order: 0 } });
  deal = await prisma.crmDeal.create({ data: { userId: wsUser.id, contactId: contact.id, pipelineId: pipeline.id, stageId: stage.id, title: "Test Deal", value: 1000000 } });
  property = await prisma.property.create({
    data: { userId: wsUser.id, title: "Test Unit", listingType: "short_term_rent", price: 0, address: "Test address", ownerContactId: contact.id },
  });
});

afterAll(async () => {
  const accounts = await prisma.accountingAccount.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entryIds } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.accountingOwnerStatementEntry.deleteMany({ where: { statement: { workspaceUserId: wsUser.id } } });
  await prisma.accountingOwnerStatement.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingCommissionSplit.deleteMany({ where: { commissionRecord: { workspaceUserId: wsUser.id } } });
  await prisma.accountingCommissionRecord.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingExpense.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } });
  await prisma.property.delete({ where: { id: property.id } });
  await prisma.crmDeal.delete({ where: { id: deal.id } });
  await prisma.crmStage.delete({ where: { id: stage.id } });
  await prisma.crmPipeline.delete({ where: { id: pipeline.id } });
  await prisma.crmContact.delete({ where: { id: contact.id } });
  await prisma.user.delete({ where: { id: userA.id } });
  await prisma.user.delete({ where: { id: userB.id } });
  await prisma.user.delete({ where: { id: wsUser.id } });
});

describe("expenses — approval workflow", () => {
  it("a small expense is auto-approved; a large one requires approval before it can be paid", async () => {
    const small = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5200", amount: 100000, description: "Small ad spend" });
    expect(small.status).toBe("approved");

    const large = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5200", amount: 10_000_000, description: "Big campaign" });
    expect(large.status).toBe("pending_approval");

    await expect(payExpense(large.id, "system")).rejects.toThrow();

    await approveExpense(large.id, "manager-1");
    const paid = await payExpense(large.id, "manager-1");
    expect(paid.status).toBe("paid");

    const tb = await getTrialBalance(wsUser.id);
    const cash = tb.find((r) => r.code === "1000");
    // small (100k, auto-approved) was never paid, only large (10M) was
    expect(cash?.creditTotal).toBe(10_000_000);
  });
});

describe("commission — split correctness", () => {
  it("rejects splits that don't sum to 100%", async () => {
    await expect(createCommissionRecord(wsUser.id, deal.id, 1000000, [{ agentUserId: userA.id, percent: 60 }])).rejects.toThrow();
  });

  it("splits a commission across two agents and posts each split independently", async () => {
    const record = await createCommissionRecord(wsUser.id, deal.id, 1000000, [
      { agentUserId: userA.id, percent: 70 },
      { agentUserId: userB.id, percent: 30 },
    ]);
    expect(record.splits).toHaveLength(2);
    const splitA = record.splits.find((s) => s.agentUserId === userA.id)!;
    const splitB = record.splits.find((s) => s.agentUserId === userB.id)!;
    expect(splitA.amount).toBe(700000);
    expect(splitB.amount).toBe(300000);

    await payCommissionSplit(splitA.id, "system");
    const stillPending = await prisma.accountingCommissionSplit.findUniqueOrThrow({ where: { id: splitB.id } });
    expect(stillPending.status).toBe("pending");

    const paidA = await prisma.accountingCommissionSplit.findUniqueOrThrow({ where: { id: splitA.id } });
    expect(paidA.status).toBe("paid");
  });
});

describe("owner statement — three-row summary + ledger balance", () => {
  it("computes netProfit/managementFee/ownerShare correctly and posts a balanced entry on approval", async () => {
    await prisma.accountingManagementFeeRule.create({ data: { workspaceUserId: wsUser.id, propertyId: property.id, feePercent: 20 } });

    const statement = await generateOwnerStatement(wsUser.id, property.id, new Date("2026-08-01"), [
      { date: new Date("2026-08-05"), description: "Guest stay", category: "guest_stay", income: 1000000 },
      { date: new Date("2026-08-10"), description: "Cleaning", category: "maintenance", expense: 100000 },
      { date: new Date("2026-08-15"), description: "Utilities", category: "utilities", expense: 50000 },
    ]);

    expect(statement.incomeTotal).toBe(1000000);
    expect(statement.expenseTotal).toBe(150000);
    expect(statement.netProfit).toBe(850000);
    expect(statement.managementFee).toBe(170000); // 20% of 850000
    expect(statement.ownerShare).toBe(680000);
    expect(statement.managementFee + statement.ownerShare).toBe(statement.netProfit);

    await approveOwnerStatement(statement.id, "manager-1");

    const tb = await getTrialBalance(wsUser.id);
    const totalDebit = tb.reduce((s, r) => s + r.debitTotal, 0);
    const totalCredit = tb.reduce((s, r) => s + r.creditTotal, 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);

    const ownerPayable = tb.find((r) => r.code === "2200");
    expect(ownerPayable?.balance).toBe(680000);
  });

  it("rejects regenerating an already-approved statement", async () => {
    const approved = await prisma.accountingOwnerStatement.findFirst({ where: { workspaceUserId: wsUser.id, status: "approved" } });
    await expect(
      generateOwnerStatement(wsUser.id, approved!.propertyId, approved!.month, [{ date: new Date(), description: "x", category: "other", income: 1 }])
    ).rejects.toThrow();
  });
});
