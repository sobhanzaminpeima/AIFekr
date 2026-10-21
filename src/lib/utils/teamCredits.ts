import { prisma } from "@/lib/db/prisma";

/**
 * Every credit-costing operation (chat, image, video, music) should check
 * and deduct through these two functions instead of touching User.credits
 * directly. If the user has joined a Team (as owner or member), credits
 * are pooled on the Team; otherwise they behave exactly as before, on the
 * User row itself.
 */

export async function getAvailableCredits(userId: string): Promise<number> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId },
    include: { team: true },
  });
  if (membership) return membership.team.credits;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return user?.credits ?? 0;
}

/**
 * Atomically deduct credits, guarded by `credits >= amount`.
 * Throws if the balance is insufficient so callers can return a 402 instead of
 * silently overdrawing.
 */
export async function deductCredits(userId: string, amount: number): Promise<void> {
  const membership = await prisma.teamMember.findUnique({ where: { userId } });

  if (membership) {
    const updated = await prisma.team.updateMany({
      where: { id: membership.teamId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (updated.count === 0) throw new Error("INSUFFICIENT_CREDITS");
    return;
  }

  const updated = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  if (updated.count === 0) throw new Error("INSUFFICIENT_CREDITS");
}
