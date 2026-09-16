import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Every credit-costing operation (chat, image, video, music) should check
 * and deduct through these functions instead of touching User.credits
 * directly. If the user has joined a Team (as owner or member), credits
 * are pooled on the Team; otherwise they behave exactly as before, on the
 * User row itself.
 *
 * Deduction is guarded and atomic. It used to be a bare `{ decrement }`,
 * with the balance check living in the caller as a separate await — a
 * check-then-act gap that let two concurrent requests both pass the check
 * and drive the balance negative. `updateMany` with a `credits: { gte }`
 * predicate compiles to `UPDATE ... WHERE id = ? AND credits >= ?`, so the
 * database itself decides the winner and `count === 0` means "not enough
 * credits" — the caller MUST check the boolean and refuse the work.
 */

/** Accepts either the shared client or an interactive-transaction client. */
type Db = Prisma.TransactionClient | typeof prisma;

export async function getAvailableCredits(userId: string, db: Db = prisma): Promise<number> {
  const membership = await db.teamMember.findUnique({
    where: { userId },
    include: { team: true },
  });
  if (membership) return membership.team.credits;

  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return user?.credits ?? 0;
}

/**
 * Atomically deducts `amount` if — and only if — the balance covers it.
 * Returns false when it does not; callers must treat false as "payment
 * declined" and not perform the paid work.
 */
export async function deductCredits(userId: string, amount: number, db: Db = prisma): Promise<boolean> {
  if (amount <= 0) return true;

  const membership = await db.teamMember.findUnique({ where: { userId } });
  if (membership) {
    const { count } = await db.team.updateMany({
      where: { id: membership.teamId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    return count > 0;
  }

  const { count } = await db.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  return count > 0;
}

/** Reverses a deductCredits() call — used when a job charged up-front (e.g. async video generation) ends up failing. */
export async function refundCredits(userId: string, amount: number, db: Db = prisma): Promise<void> {
  if (amount <= 0) return;

  const membership = await db.teamMember.findUnique({ where: { userId } });
  if (membership) {
    await db.team.update({ where: { id: membership.teamId }, data: { credits: { increment: amount } } });
    return;
  }
  await db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
}

export interface UsageRecord {
  /** Feature tag, e.g. "chat" | "image" | "video" | "music". */
  type: string;
  model?: string | null;
  tokens?: number | null;
  metadata?: Record<string, unknown> | null;
  /** Provider id from src/lib/ai/providers.ts, or a stable string for media routes not in that registry (e.g. "qwen-image"). */
  provider?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  mediaSeconds?: number | null;
  voiceSeconds?: number | null;
  /** Computed from AiModelPricing at charge time if omitted and `provider` is set. */
  estimatedCostUsd?: number | null;
  /** For providers that report real billed cost (e.g. Vapi voice calls). */
  actualCostUsd?: number | null;
  requestId?: string | null;
}

/**
 * Charges credits and writes the matching UsageLog row in ONE transaction.
 *
 * These were two separate statements at every call site, so a crash in
 * between either charged with no record of why, or recorded usage that was
 * never charged. Chat was the worst case: both sat inside a try/catch that
 * swallowed the failure and still returned 200, handing out free answers.
 *
 * Returns false when the balance doesn't cover the charge — nothing is
 * written in that case, and the caller must refuse the work.
 */
export async function chargeAndLog(userId: string, amount: number, usage: UsageRecord): Promise<boolean> {
  // Cost lookup hits AiModelPricing, which callers won't have looked up
  // themselves -- computed outside the transaction since it's a read of a
  // table nothing here writes to, so there's no need to hold it up.
  let estimatedCostUsd = usage.estimatedCostUsd ?? null;
  if (estimatedCostUsd == null && usage.provider) {
    const { estimateCostUsd } = await import("@/lib/ai/costEstimator");
    const kind = usage.type as "chat" | "image" | "video" | "music" | "voice";
    if (kind === "chat") {
      estimatedCostUsd = await estimateCostUsd({
        kind: "chat",
        providerId: usage.provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
      });
    } else if (kind === "image" || kind === "video" || kind === "music" || kind === "voice") {
      const units = usage.mediaSeconds ?? usage.voiceSeconds ?? 1;
      estimatedCostUsd = await estimateCostUsd({ kind, providerId: usage.provider, units });
    }
  }

  return prisma.$transaction(async (tx) => {
    const charged = await deductCredits(userId, amount, tx);
    if (!charged) return false;

    await tx.usageLog.create({
      data: {
        userId,
        type: usage.type,
        model: usage.model ?? undefined,
        tokens: usage.tokens ?? undefined,
        credits: amount,
        metadata: usage.metadata ? JSON.stringify(usage.metadata) : undefined,
        provider: usage.provider ?? undefined,
        inputTokens: usage.inputTokens ?? undefined,
        outputTokens: usage.outputTokens ?? undefined,
        cachedTokens: usage.cachedTokens ?? undefined,
        mediaSeconds: usage.mediaSeconds ?? undefined,
        voiceSeconds: usage.voiceSeconds ?? undefined,
        estimatedCostUsd: estimatedCostUsd ?? undefined,
        actualCostUsd: usage.actualCostUsd ?? undefined,
        requestId: usage.requestId ?? undefined,
      },
    });
    return true;
  });
}
