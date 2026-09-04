import { prisma } from "@/lib/db/prisma";
import { postJournalEntry } from "./ledger";

/**
 * Simple payroll (spec ۳.۵): base salary + commission + bonus/deductions,
 * printable payslip. Lifecycle mirrors the rest of the module's
 * Draft-and-Approve pattern — draft (editable) → approved (frozen) → paid
 * (posts one aggregate ledger entry for the whole run). No integration with
 * Iranian payroll tax/insurance withholding — explicitly out of scope for
 * this MVP per the spec ("به‌عنوان افزونه آینده، نه در MVP این ماژول").
 *
 * There is no server-side PDF generator in this codebase (no pdfkit/
 * puppeteer dependency) — same simplification already made for owner
 * statements in Phase B: a payslip is a printable HTML view
 * (browser print-to-PDF), not a server-rendered PDF file.
 */

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export interface UpsertEmployeeInput {
  workspaceUserId: string;
  id?: string;
  userId?: string | null;
  name?: string;
  baseSalary?: number;
  isActive?: boolean;
}

export async function upsertEmployee(input: UpsertEmployeeInput) {
  if (input.id) {
    const existing = await prisma.accountingEmployee.findFirst({ where: { id: input.id, workspaceUserId: input.workspaceUserId } });
    if (!existing) throw new Error("Employee not found in this workspace");
    return prisma.accountingEmployee.update({
      where: { id: input.id },
      data: { name: input.name || existing.name, userId: input.userId, baseSalary: input.baseSalary, isActive: input.isActive },
    });
  }
  if (!input.name) throw new Error("Employee name is required");
  return prisma.accountingEmployee.create({
    data: {
      workspaceUserId: input.workspaceUserId,
      userId: input.userId || null,
      name: input.name,
      baseSalary: input.baseSalary || 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function listEmployees(workspaceUserId: string) {
  return prisma.accountingEmployee.findMany({ where: { workspaceUserId }, orderBy: { createdAt: "asc" } });
}

/**
 * Creates (or, while still draft, regenerates) a payroll run for a month:
 * one payslip per active employee, with commissionTotal pulled live from
 * AccountingCommissionSplit rows paid to that employee's userId during the
 * period — never a second, independently-typed commission number. bonus/
 * deductions default to 0 and are editable via updatePayslip() until the
 * run is approved.
 */
export async function generatePayrollRun(workspaceUserId: string, period: Date) {
  const periodStart = monthStart(period);
  const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0, 23, 59, 59));

  const existing = await prisma.accountingPayrollRun.findUnique({ where: { workspaceUserId_period: { workspaceUserId, period: periodStart } } });
  if (existing && existing.status !== "draft") {
    throw new Error("This payroll run is already approved/paid — it cannot be regenerated.");
  }

  const employees = await prisma.accountingEmployee.findMany({ where: { workspaceUserId, isActive: true } });
  if (employees.length === 0) throw new Error("No active employees to run payroll for");

  const payslipData = await Promise.all(
    employees.map(async (emp) => {
      let commissionTotal = 0;
      if (emp.userId) {
        const agg = await prisma.accountingCommissionSplit.aggregate({
          where: { agentUserId: emp.userId, status: "paid", paidAt: { gte: periodStart, lte: periodEnd }, commissionRecord: { workspaceUserId } },
          _sum: { amount: true },
        });
        commissionTotal = agg._sum.amount || 0;
      }
      return {
        employeeId: emp.id,
        baseSalary: emp.baseSalary,
        commissionTotal,
        bonus: 0,
        deductions: 0,
        netPay: emp.baseSalary + commissionTotal,
      };
    })
  );

  if (existing) {
    await prisma.accountingPayslip.deleteMany({ where: { payrollRunId: existing.id } });
    return prisma.accountingPayrollRun.update({
      where: { id: existing.id },
      data: { payslips: { create: payslipData } },
      include: { payslips: { include: { employee: true } } },
    });
  }

  return prisma.accountingPayrollRun.create({
    data: { workspaceUserId, period: periodStart, payslips: { create: payslipData } },
    include: { payslips: { include: { employee: true } } },
  });
}

/** Adjusts a single payslip's bonus/deductions before the run is approved. */
export async function updatePayslip(payslipId: string, workspaceUserId: string, bonus?: number, deductions?: number) {
  const payslip = await prisma.accountingPayslip.findUniqueOrThrow({ where: { id: payslipId }, include: { payrollRun: true } });
  if (payslip.payrollRun.workspaceUserId !== workspaceUserId) throw new Error("Payslip not found in this workspace");
  if (payslip.payrollRun.status !== "draft") throw new Error("Only a draft run's payslips can be edited");

  const newBonus = bonus ?? payslip.bonus;
  const newDeductions = deductions ?? payslip.deductions;
  return prisma.accountingPayslip.update({
    where: { id: payslipId },
    data: { bonus: newBonus, deductions: newDeductions, netPay: payslip.baseSalary + payslip.commissionTotal + newBonus - newDeductions },
  });
}

/** Freezes a draft run's numbers — no ledger posting yet, same as an approved (not-yet-paid) expense. */
export async function approvePayrollRun(runId: string, approvedBy: string) {
  const run = await prisma.accountingPayrollRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "draft") throw new Error("Only a draft payroll run can be approved");
  return prisma.accountingPayrollRun.update({ where: { id: runId }, data: { status: "approved", approvedBy, approvedAt: new Date() } });
}

/**
 * Posts one aggregate ledger entry for the whole run — Debit 5000 (Agent
 * Salaries & Commission) / Credit 1000 (Cash) for the sum of every payslip's
 * netPay — and marks it paid. Idempotent via sourceRef.
 */
export async function payPayrollRun(runId: string, paidBy: string) {
  const run = await prisma.accountingPayrollRun.findUniqueOrThrow({ where: { id: runId }, include: { payslips: true } });
  if (run.status !== "approved") throw new Error("Only an approved payroll run can be paid");

  const total = run.payslips.reduce((s, p) => s + p.netPay, 0);
  if (total > 0) {
    await postJournalEntry({
      workspaceUserId: run.workspaceUserId,
      postedBy: paidBy,
      memo: `Payroll ${run.period.toISOString().slice(0, 7)}`,
      sourceRef: `payroll:paid:${run.id}`,
      lines: [
        { accountCode: "5000", debit: total },
        { accountCode: "1000", credit: total },
      ],
    });
  }

  return prisma.accountingPayrollRun.update({ where: { id: runId }, data: { status: "paid", paidBy, paidAt: new Date() } });
}
