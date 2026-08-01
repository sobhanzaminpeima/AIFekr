import { prisma } from "@/lib/db/prisma";
import type { Payment, User } from "@prisma/client";

/**
 * Centralizes Payment reads/writes and the plan-activation transaction that
 * used to live inline in the verify route — this is the money-moving path,
 * so it gets one audited implementation instead of being re-derived per route.
 */

export function createPendingPayment(data: { userId: string; amount: number; plan: string; gateway: string }) {
  return prisma.payment.create({ data: { ...data, status: "PENDING" } });
}

export function findPaymentById(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: { user: true } });
}

export function markPaymentAuthority(id: string, authority: string | undefined) {
  return prisma.payment.update({ where: { id }, data: { authority } });
}

export function markPaymentFailed(id: string) {
  return prisma.payment.update({ where: { id }, data: { status: "FAILED" } });
}

/**
 * Marks a payment SUCCESS and activates the purchased plan in one transaction.
 * TEAM plans pool credits on a Team row (created on first purchase, topped up
 * on renewal); all other plans credit User.credits directly. Returns the new
 * plan expiry date so the caller can use it in confirmation messaging.
 */
export async function activatePlanForPayment(
  payment: Payment & { user: User },
  refId: string,
  authority: string,
  planInfo: { credits: number; days: number } | undefined
): Promise<Date> {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (planInfo?.days || 30));

  if (payment.plan === "TEAM") {
    const existingTeam = await prisma.team.findUnique({ where: { ownerId: payment.userId } });
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({ where: { id: payment.userId }, data: { plan: "TEAM", planExpiry: expiry } }),
      existingTeam
        ? prisma.team.update({
            where: { id: existingTeam.id },
            data: { credits: { increment: planInfo?.credits || 0 }, planExpiry: expiry },
          })
        : prisma.team.create({
            data: {
              name: `تیم ${payment.user.name || "من"}`,
              ownerId: payment.userId,
              credits: planInfo?.credits || 0,
              planExpiry: expiry,
              members: { create: { userId: payment.userId, role: "OWNER" } },
            },
          }),
    ]);
  } else {
    await Promise.all([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({
        where: { id: payment.userId },
        data: { plan: payment.plan, credits: { increment: planInfo?.credits || 0 }, planExpiry: expiry },
      }),
    ]);
  }

  return expiry;
}
