import { prisma } from "@/lib/db/prisma";
import { postJournalEntry } from "./ledger";
import { bizScope } from "./scope";

/**
 * Agent commission with split support (spec ۳.۴). A commission record is
 * created once per won deal; its total is divided across one or more
 * agents via splits (percent-based, must sum to 100). Each split posts to
 * the ledger independently when paid, since agents are often paid on
 * different days.
 */

export interface CommissionSplitInput {
  agentUserId: string;
  percent: number;
}

export async function createCommissionRecord(workspaceUserId: string, dealId: string, totalAmount: number, splits: CommissionSplitInput[], businessId?: string | null) {
  if (splits.length === 0) throw new Error("At least one agent split is required");
  const percentTotal = splits.reduce((s, sp) => s + sp.percent, 0);
  if (Math.abs(percentTotal - 100) > 0.01) throw new Error(`Split percentages must sum to 100, got ${percentTotal}`);

  return prisma.accountingCommissionRecord.create({
    data: {
      workspaceUserId,
      ...bizScope(businessId),
      dealId,
      totalAmount,
      splits: {
        create: splits.map((s) => ({
          agentUserId: s.agentUserId,
          percent: s.percent,
          amount: Math.round((totalAmount * s.percent) / 100),
        })),
      },
    },
    include: { splits: true },
  });
}

/** Pays one agent's split — posts Debit 5000 (Agent Commission) / Credit 1000 (Cash), idempotent via sourceRef. */
export async function payCommissionSplit(splitId: string, paidBy: string, scope?: { workspaceUserId: string; businessId?: string | null }) {
  const split = await prisma.accountingCommissionSplit.findUniqueOrThrow({
    where: { id: splitId },
    include: { commissionRecord: true },
  });
  // Defence in depth: the route already checks ownership, but a caller that skips it must not be able to pay another business's split.
  if (scope && (split.commissionRecord.workspaceUserId !== scope.workspaceUserId || (scope.businessId && split.commissionRecord.businessId !== scope.businessId))) {
    throw new Error("Commission split not found in this workspace");
  }
  if (split.status === "paid") return split;

  await postJournalEntry({
    workspaceUserId: split.commissionRecord.workspaceUserId,
    businessId: split.commissionRecord.businessId ?? undefined,
    postedBy: paidBy,
    memo: `Commission split for deal ${split.commissionRecord.dealId}`,
    sourceRef: `commission_split:paid:${split.id}`,
    lines: [
      { accountCode: "5000", debit: split.amount },
      { accountCode: "1000", credit: split.amount },
    ],
  });

  return prisma.accountingCommissionSplit.update({ where: { id: splitId }, data: { status: "paid", paidAt: new Date() } });
}
