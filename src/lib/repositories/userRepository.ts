import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Centralizes User reads/writes that used to be inline `prisma.user.*` calls
 * scattered across auth and payment routes — one place to get scoping and
 * credit-grant logic right instead of trusting every route author to repeat it.
 */

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } });
}

export function findUserByReferralCode(code: string) {
  return prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
}

export function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data });
}

export function updatePasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** Records a successful login, optionally upgrading a legacy password hash in the same write. */
export function recordLogin(userId: string, rehashedPassword?: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), ...(rehashedPassword ? { passwordHash: rehashedPassword } : {}) },
  });
}

/**
 * Grants the one-time referral bonus to both sides of a referral atomically.
 * Caller is responsible for the `referralRewarded` guard check before calling
 * this (kept out of the transaction so a failed lookup doesn't need a rollback).
 */
export function grantReferralBonus(userId: string, referrerId: string, amount: number) {
  return prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { credits: { increment: amount }, referralRewarded: true } }),
    prisma.user.update({ where: { id: referrerId }, data: { credits: { increment: amount } } }),
  ]);
}

/** Removes a team seat and resets the departing member back to the FREE plan, atomically. */
export function removeTeamSeatAndResetPlan(teamMemberUserId: string) {
  return prisma.$transaction([
    prisma.teamMember.delete({ where: { userId: teamMemberUserId } }),
    prisma.user.update({ where: { id: teamMemberUserId }, data: { plan: "FREE" } }),
  ]);
}

/** Redeems a team invite: seats the user, marks the invite accepted, and upgrades their plan — atomically. */
export function acceptTeamInvite(inviteId: string, teamId: string, userId: string) {
  return prisma.$transaction([
    prisma.teamMember.create({ data: { teamId, userId, role: "MEMBER" } }),
    prisma.teamInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } }),
    prisma.user.update({ where: { id: userId }, data: { plan: "TEAM" } }),
  ]);
}
