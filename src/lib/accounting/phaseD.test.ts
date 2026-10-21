import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { upsertEmployee, generatePayrollRun, updatePayslip, approvePayrollRun, payPayrollRun } from "./payroll";
import { createScheduledReport, runDueScheduledReports, approveFirstRun } from "./scheduledReports";
import { createApiToken, verifyApiToken, revokeApiToken, getBiExport } from "./biApi";
import { postJournalEntry } from "./ledger";

const WS = `test-phased-${Date.now()}`;
let wsUser: { id: string };
let agentUser: { id: string };
let commissionRecordId: string;

beforeAll(async () => {
  wsUser = await prisma.user.create({ data: { name: "PhaseD Workspace", email: `phased-ws-${Date.now()}@test.local`, passwordHash: "x" } });
  agentUser = await prisma.user.create({ data: { name: "PhaseD Agent", email: `phased-agent-${Date.now()}@test.local`, passwordHash: "x" } });
  await prisma.accountingAccount.createMany({
    data: [
      { workspaceUserId: wsUser.id, code: "1000", name: "Cash", type: "asset" },
      { workspaceUserId: wsUser.id, code: "5000", name: "Salaries", type: "expense" },
      { workspaceUserId: wsUser.id, code: "4000", name: "Revenue", type: "revenue" },
    ],
  });

  // A paid commission split for the agent, inside the current month, so the
  // payroll run's commissionTotal picks it up automatically.
  const contact = await prisma.crmContact.create({ data: { userId: wsUser.id, name: "PhaseD Client" } });
  const pipeline = await prisma.crmPipeline.create({ data: { userId: wsUser.id, name: "Default" } });
  const stage = await prisma.crmStage.create({ data: { pipelineId: pipeline.id, name: "Won", order: 1, isWon: true } });
  const deal = await prisma.crmDeal.create({ data: { userId: wsUser.id, contactId: contact.id, pipelineId: pipeline.id, stageId: stage.id, title: "Deal", value: 1000000, ownerId: agentUser.id, status: "won" } });
  const record = await prisma.accountingCommissionRecord.create({ data: { workspaceUserId: wsUser.id, dealId: deal.id, totalAmount: 100000 } });
  commissionRecordId = record.id;
  await prisma.accountingCommissionSplit.create({
    data: { commissionRecordId: record.id, agentUserId: agentUser.id, percent: 100, amount: 100000, status: "paid", paidAt: new Date() },
  });
});

afterAll(async () => {
  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entryIds } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { id: { in: entryIds } } });

  const runs = await prisma.accountingPayrollRun.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  await prisma.accountingPayslip.deleteMany({ where: { payrollRunId: { in: runs.map((r) => r.id) } } });
  await prisma.accountingPayrollRun.deleteMany({ where: { id: { in: runs.map((r) => r.id) } } });
  await prisma.accountingEmployee.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingScheduledReport.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingApiToken.deleteMany({ where: { workspaceUserId: wsUser.id } });

  await prisma.accountingCommissionSplit.deleteMany({ where: { commissionRecordId } });
  await prisma.accountingCommissionRecord.deleteMany({ where: { id: commissionRecordId } });
  const pipelines = await prisma.crmPipeline.findMany({ where: { userId: wsUser.id }, select: { id: true } });
  await prisma.crmDeal.deleteMany({ where: { userId: wsUser.id } });
  await prisma.crmStage.deleteMany({ where: { pipelineId: { in: pipelines.map((p) => p.id) } } });
  await prisma.crmPipeline.deleteMany({ where: { userId: wsUser.id } });
  await prisma.crmContact.deleteMany({ where: { userId: wsUser.id } });
  await prisma.accountingAccount.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.user.delete({ where: { id: wsUser.id } });
  await prisma.user.delete({ where: { id: agentUser.id } });
});

describe("payroll", () => {
  it("pulls commission from real paid splits, applies bonus/deductions, and posts one balanced entry on pay", async () => {
    const employee = await upsertEmployee({ workspaceUserId: wsUser.id, name: "Test Agent", userId: agentUser.id, baseSalary: 500000 });

    const run = await generatePayrollRun(wsUser.id, new Date());
    const payslip = run.payslips.find((p) => p.employeeId === employee.id)!;
    expect(payslip.baseSalary).toBe(500000);
    expect(payslip.commissionTotal).toBe(100000);
    expect(payslip.netPay).toBe(600000);

    const updated = await updatePayslip(payslip.id, wsUser.id, 50000, 20000);
    expect(updated.netPay).toBe(630000); // 500000 + 100000 + 50000 - 20000

    await expect(payPayrollRun(run.id, "manager-1")).rejects.toThrow(); // still draft

    await approvePayrollRun(run.id, "manager-1");
    const paidRun = await payPayrollRun(run.id, "manager-1");
    expect(paidRun.status).toBe("paid");

    const entry = await prisma.accountingJournalEntry.findUnique({ where: { sourceRef: `payroll:paid:${run.id}` }, include: { lines: true } });
    expect(entry).not.toBeNull();
    const debitTotal = entry!.lines.reduce((s, l) => s + l.debit, 0);
    const creditTotal = entry!.lines.reduce((s, l) => s + l.credit, 0);
    expect(debitTotal).toBe(creditTotal);
    expect(debitTotal).toBe(630000);
  });

  it("rejects regenerating an already-approved run", async () => {
    await upsertEmployee({ workspaceUserId: wsUser.id, name: "Solo Agent", baseSalary: 200000 });
    const period = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
    const run = await generatePayrollRun(wsUser.id, period);
    await approvePayrollRun(run.id, "manager-1");
    await expect(generatePayrollRun(wsUser.id, period)).rejects.toThrow();
  });
});

describe("scheduled reports — never auto-send before human approval", () => {
  it("a new schedule's first due run only produces a preview, never an email", async () => {
    const report = await createScheduledReport({ workspaceUserId: wsUser.id, reportType: "monthly_pl", frequency: "monthly", recipientEmail: "owner@test.local" });
    expect(report.status).toBe("pending_first_approval");

    const result = await runDueScheduledReports();
    expect(result.previewed).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBe(0); // nothing auto-emailed yet

    const refreshed = await prisma.accountingScheduledReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(refreshed.status).toBe("awaiting_approval");
    expect(refreshed.firstRunPreview).not.toBeNull();
  });

  it("approving the first run activates recurring auto-send", async () => {
    const report = await createScheduledReport({ workspaceUserId: wsUser.id, reportType: "monthly_vat", frequency: "monthly", recipientEmail: "owner2@test.local" });
    await runDueScheduledReports();

    const approved = await approveFirstRun(report.id, wsUser.id);
    expect(approved.status).toBe("active");
    expect(approved.lastRunAt).not.toBeNull();

    // Not due again immediately after just running.
    const result = await runDueScheduledReports();
    expect(result.sent).toBe(0);
  });
});

describe("BI export API", () => {
  it("issues a token, verifies it, and returns real ledger-derived data — then revokes it", async () => {
    await postJournalEntry({
      workspaceUserId: wsUser.id,
      postedBy: "system",
      lines: [
        { accountCode: "1000", debit: 300000 },
        { accountCode: "4000", credit: 300000 },
      ],
    });

    const { token } = await createApiToken(wsUser.id, "Test BI Tool");
    const resolvedWs = await verifyApiToken(token);
    expect(resolvedWs).toBe(wsUser.id);

    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = new Date();
    const data = await getBiExport(wsUser.id, from, to);
    expect(data.profitAndLoss.revenueTotal).toBeGreaterThanOrEqual(300000);

    const tokenRow = await prisma.accountingApiToken.findFirstOrThrow({ where: { workspaceUserId: wsUser.id, label: "Test BI Tool" } });
    await revokeApiToken(tokenRow.id, wsUser.id);
    expect(await verifyApiToken(token)).toBeNull();
  });

  it("rejects a garbage token", async () => {
    expect(await verifyApiToken("not-a-real-token")).toBeNull();
  });
});
