import { prisma } from "@/lib/db/prisma";
import { bizScope } from "./scope";

/**
 * Fiscal periods and closing (spec ۳.۱۰) — never built until now, only its
 * enforcement side existed (postJournalEntry() already refuses to post into
 * a locked period's date range, see ledger.ts). This file adds the actual
 * lifecycle: create a period, close it (lock), reopen it (spec: "بازگشایی
 * فقط با تأیید صریح و ثبت در لاگ ممیزی" — always human-triggered, always
 * audit-logged, never silent).
 *
 * Every function accepts an optional trailing `businessId`: when supplied the
 * period is created in / looked up within that business only, so a member of
 * business A can never close or reopen business B's period by guessing an id.
 */

export async function createFiscalPeriod(workspaceUserId: string, startDate: Date, endDate: Date, businessId?: string | null) {
  if (endDate <= startDate) throw new Error("End date must be after start date");
  return prisma.accountingFiscalPeriod.create({ data: { workspaceUserId, startDate, endDate, ...bizScope(businessId) } });
}

export async function listFiscalPeriods(workspaceUserId: string, businessId?: string | null) {
  return prisma.accountingFiscalPeriod.findMany({ where: { workspaceUserId, ...bizScope(businessId) }, orderBy: { startDate: "desc" } });
}

export async function closeFiscalPeriod(periodId: string, workspaceUserId: string, closedBy: string, businessId?: string | null) {
  const period = await prisma.accountingFiscalPeriod.findFirst({ where: { id: periodId, workspaceUserId, ...bizScope(businessId) } });
  if (!period) throw new Error("Fiscal period not found in this workspace");
  if (period.isLocked) throw new Error("This period is already closed");

  const updated = await prisma.accountingFiscalPeriod.update({
    where: { id: periodId },
    data: { isLocked: true, lockedAt: new Date(), lockedBy: closedBy },
  });
  await prisma.auditLog.create({
    data: { actorId: closedBy, action: "fiscal_period_closed", targetId: periodId, metadata: JSON.stringify({ workspaceUserId, businessId: businessId ?? null, startDate: period.startDate, endDate: period.endDate }) },
  }).catch(() => {});
  return updated;
}

/** Reopening is always explicit and always logged — spec's non-negotiable rule for this action. */
export async function reopenFiscalPeriod(periodId: string, workspaceUserId: string, reopenedBy: string, businessId?: string | null) {
  const period = await prisma.accountingFiscalPeriod.findFirst({ where: { id: periodId, workspaceUserId, ...bizScope(businessId) } });
  if (!period) throw new Error("Fiscal period not found in this workspace");
  if (!period.isLocked) throw new Error("This period is not closed");

  const updated = await prisma.accountingFiscalPeriod.update({
    where: { id: periodId },
    data: { isLocked: false, lockedAt: null, lockedBy: null },
  });
  await prisma.auditLog.create({
    data: { actorId: reopenedBy, action: "fiscal_period_reopened", targetId: periodId, metadata: JSON.stringify({ workspaceUserId, businessId: businessId ?? null, startDate: period.startDate, endDate: period.endDate }) },
  }).catch(() => {});
  return updated;
}
