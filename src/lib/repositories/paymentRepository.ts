import { prisma } from "@/lib/db/prisma";
import type { Payment, User } from "@prisma/client";
import { STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE, isStudentIntroPlan, STUDENT_OFFER } from "@/lib/plans/studentOffer";

/**
 * Centralizes Payment reads/writes and the plan-activation transaction that
 * used to live inline in the verify route — this is the money-moving path,
 * so it gets one audited implementation instead of being re-derived per route.
 */

export function createPendingPayment(data: { userId: string; amount: number; plan: string; gateway: string; walletDiscountToman?: number; periodMonths?: number }) {
  if (isStudentIntroPlan(data.plan)) return prisma.$transaction(async tx => {
    const prior = await tx.payment.findFirst({ where: { userId: data.userId, plan: { startsWith: "STUDENT_" }, status: { in: ["PENDING", "SUCCESS"] } }, select: { id: true } });
    if (prior) throw new Error("STUDENT_OFFER_ALREADY_USED");
    return tx.payment.create({ data: { ...data, status: "PENDING" } });
  });
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
  planInfo: { credits: number; days: number; crmSeatLimit?: number | null; teamSeatLimit?: number | null } | undefined
): Promise<Date> {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (planInfo?.days || 30) * Math.max(1, payment.periodMonths ?? 1));

  if (isStudentIntroPlan(payment.plan) || payment.plan === STUDENT_MONTHLY_CODE) {
    // Student packages grant their stored credits once for the purchased term.
    const days = payment.plan === STUDENT_PLAN_CODE ? STUDENT_OFFER.days : isStudentIntroPlan(payment.plan) ? 60 : 30 * Math.max(1, payment.periodMonths ?? 1);
    expiry.setTime(Date.now() + days * 24 * 60 * 60 * 1000);
    return prisma.$transaction(async tx => {
      const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "SUCCESS", refId, authority } });
      if (!claimed.count) {
        const current = await tx.user.findUniqueOrThrow({ where: { id: payment.userId }, select: { planExpiry: true } });
        return current.planExpiry || expiry;
      }
      await tx.user.update({ where: { id: payment.userId }, data: { plan: payment.plan, accountType: "STUDENT", planExpiry: expiry, credits: { increment: planInfo?.credits || 0 }, trialLimited: false } });
      const education=await tx.industryPack.findUnique({where:{slug:"university"},select:{id:true}});if(!education)throw new Error("STUDENT_INDUSTRY_NOT_CONFIGURED");await tx.user.update({where:{id:payment.userId},data:{industryPackId:education.id}});
      await tx.userModuleOverride.upsert({ where: { userId_moduleKey: { userId: payment.userId, moduleKey: "student.workspace" } }, create: { userId: payment.userId, moduleKey: "student.workspace", enabled: true }, update: { enabled: true } });
      return expiry;
    });
  }

  // CRM add-on plans are billed and activated separately from the AI-usage
  // `plan` field — buying CRM_SOLO/CRM_TEAM must never touch/overwrite a
  // user's existing AI plan (FREE/ECHO/PLUS/PRO/ALPHA/TEAM).
  if (payment.plan.startsWith("CRM_")) {
    const crmPlan = payment.plan === "CRM_TEAM" ? "TEAM" : "SOLO";

    if (crmPlan === "TEAM") {
      const seatLimit = planInfo?.crmSeatLimit || 5;
      const existingTeam = await prisma.team.findUnique({ where: { ownerId: payment.userId } });
      if (existingTeam) {
        await prisma.$transaction([
          prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
          prisma.user.update({ where: { id: payment.userId }, data: { crmPlan, crmPlanExpiry: expiry } }),
          prisma.team.update({ where: { id: existingTeam.id }, data: { maxSeats: Math.max(existingTeam.maxSeats, seatLimit) } }),
          prisma.teamMember.upsert({
            where: { userId: payment.userId },
            update: { crmRole: "OWNER" },
            create: { teamId: existingTeam.id, userId: payment.userId, role: "OWNER", crmRole: "OWNER" },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
          prisma.user.update({ where: { id: payment.userId }, data: { crmPlan, crmPlanExpiry: expiry } }),
          prisma.team.create({
            data: {
              name: `تیم ${payment.user.name || "من"}`,
              ownerId: payment.userId,
              maxSeats: seatLimit,
              members: { create: { userId: payment.userId, role: "OWNER", crmRole: "OWNER" } },
            },
          }),
        ]);
      }
    } else {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
        prisma.user.update({ where: { id: payment.userId }, data: { crmPlan, crmPlanExpiry: expiry } }),
      ]);
    }

    return expiry;
  }

  // One-off credit top-up — same independent-billing pattern as CRM_*/VOICE_*
  // above, but simpler: no plan/expiry touched at all, just a straight
  // credits increment. `planInfo.credits` here is the tier's creditsAmount.
  if (payment.plan.startsWith("CREDITS_")) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({ where: { id: payment.userId }, data: { credits: { increment: planInfo?.credits || 0 } } }),
    ]);
    return expiry;
  }

  // Voice Agent add-on — same independent-billing pattern as CRM_* above:
  // must never touch/overwrite the user's AI-usage `plan`.
  if (payment.plan.startsWith("VOICE_")) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({ where: { id: payment.userId }, data: { voicePlan: "ACTIVE", voicePlanExpiry: expiry } }),
    ]);
    return expiry;
  }

  if (payment.plan === "TEAM" || payment.plan.startsWith("TEAM_")) {
    const seatLimit = planInfo?.teamSeatLimit || 5;
    const existingTeam = await prisma.team.findUnique({ where: { ownerId: payment.userId } });
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({ where: { id: payment.userId }, data: { plan: "TEAM", accountType: "BUSINESS", planExpiry: expiry, trialLimited: false } }),
      existingTeam
        ? prisma.team.update({
            where: { id: existingTeam.id },
            data: { credits: { increment: planInfo?.credits || 0 }, planExpiry: expiry, maxSeats: Math.max(existingTeam.maxSeats, seatLimit) },
          })
        : prisma.team.create({
            data: {
              name: `تیم ${payment.user.name || "من"}`,
              ownerId: payment.userId,
              credits: planInfo?.credits || 0,
              planExpiry: expiry,
              maxSeats: seatLimit,
              members: { create: { userId: payment.userId, role: "OWNER" } },
            },
          }),
    ]);
  } else {
    await Promise.all([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", refId, authority } }),
      prisma.user.update({
        where: { id: payment.userId },
        // Clearing trialLimited here is what turns "upgrade your account" for
        // a referral-trial user into "your previous business data is
        // restored" -- see activate-trial/route.ts for where it's first set.
        data: { plan: payment.plan, credits: { increment: planInfo?.credits || 0 }, planExpiry: expiry, trialLimited: false },
      }),
    ]);
  }

  return expiry;
}
