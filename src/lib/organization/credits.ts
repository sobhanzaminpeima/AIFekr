import { prisma } from "@/lib/db/prisma";

export type OrganizationResource = "AI_CREDIT" | "MEDIA_CREDIT" | "VOICE_MINUTE";
const balanceField: Record<OrganizationResource, "aiCredits" | "mediaCredits" | "voiceMinutes"> = {
  AI_CREDIT: "aiCredits", MEDIA_CREDIT: "mediaCredits", VOICE_MINUTE: "voiceMinutes",
};

/** Atomically records a resource change and updates its balance projection. */
export async function recordOrganizationCredit(input: {
  organizationId: string; businessId?: string; userId?: string; resourceType: OrganizationResource;
  direction: "GRANT" | "USAGE" | "REFUND" | "ADJUSTMENT"; amount: number; feature?: string;
  provider?: string; model?: string; providerCostUsd?: number; metadata?: Record<string, unknown>; idempotencyKey?: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount === 0) throw new Error("Credit amount must be non-zero");
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.organizationCreditLedger.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { applied: false, ledger: existing };
    }
    const field = balanceField[input.resourceType];
    // Negative amount is consumption. The conditional update makes concurrent
    // requests safe: exactly one can consume the final available credit.
    const change = input.amount;
    if (change < 0) {
      const result = await tx.organization.updateMany({ where: { id: input.organizationId, [field]: { gte: -change } }, data: { [field]: { increment: change } } });
      if (result.count !== 1) return { applied: false, ledger: null };
    } else {
      await tx.organization.update({ where: { id: input.organizationId }, data: { [field]: { increment: change } } });
    }
    const ledger = await tx.organizationCreditLedger.create({
      data: { ...input, metadata: input.metadata ? JSON.stringify(input.metadata) : undefined },
    });
    return { applied: true, ledger };
  });
}
