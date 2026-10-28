import type { Prisma } from "@prisma/client";
import { normalizePromo, validPromo } from "./referralPromo";

/** CODE_UNAVAILABLE; formerOwnerId is set when the code is only another user's former code (kept so their old links still work). */
export class ReferralCodeTaken extends Error {
  constructor(public formerOwnerId?: string) { super("CODE_UNAVAILABLE"); }
}

/**
 * Sets a user's referral code and keeps their previous code as an alias.
 * `releaseFormerCode` (admin only) takes the code from another user's former
 * codes; links that use it then credit the new owner.
 */
export async function changeReferralCode(tx: Prisma.TransactionClient, userId: string, value: unknown, options: { releaseFormerCode?: boolean } = {}) {
  const code = normalizePromo(value);
  if (!validPromo(code)) throw Error("INVALID_CODE");
  const current = await tx.$queryRaw<{id:string}[]>`SELECT id FROM User WHERE lower(referralCode) = ${code} AND id != ${userId}`;
  if (current.length) throw new ReferralCodeTaken();
  const former = await tx.$queryRaw<{userId:string}[]>`SELECT userId FROM ReferralCodeAlias WHERE lower(code) = ${code} AND userId != ${userId}`;
  if (former.length && !options.releaseFormerCode) throw new ReferralCodeTaken(former[0].userId);
  if (former.length) await tx.$executeRaw`DELETE FROM ReferralCodeAlias WHERE lower(code) = ${code} AND userId != ${userId}`;
  const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (before.referralCode && before.referralCode.toLowerCase() !== code) {
    await tx.referralCodeAlias.upsert({ where: { code: before.referralCode.toLowerCase() }, create: { code: before.referralCode.toLowerCase(), userId }, update: {} });
  }
  await tx.user.update({ where: { id: userId }, data: { referralCode: code } });
  return { code, previousCode: before.referralCode, releasedFrom: former[0]?.userId ?? null };
}
