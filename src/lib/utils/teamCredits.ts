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

export async function deductCredits(userId: string, amount: number): Promise<void> {
  const membership = await prisma.teamMember.findUnique({ where: { userId } });
  if (membership) {
    await prisma.team.update({ where: { id: membership.teamId }, data: { credits: { decrement: amount } } });
    return;
  }
  await prisma.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } });
}

/** Reverses a deductCredits() call — used when a job charged up-front (e.g. async video generation) ends up failing. */
export async function refundCredits(userId: string, amount: number): Promise<void> {
  const membership = await prisma.teamMember.findUnique({ where: { userId } });
  if (membership) {
    await prisma.team.update({ where: { id: membership.teamId }, data: { credits: { increment: amount } } });
    return;
  }
  await prisma.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
}
