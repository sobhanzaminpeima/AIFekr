import type { Prisma } from "@prisma/client";
import { normalizePromo, validPromo } from "./referralPromo";
export async function changeReferralCode(tx: Prisma.TransactionClient, userId: string, value: unknown) {
  const code = normalizePromo(value);
  if (!validPromo(code)) throw Error("INVALID_CODE");
  const conflicts = await tx.$queryRaw<{id:string}[]>`SELECT id FROM User WHERE lower(referralCode) = ${code} AND id != ${userId} UNION SELECT userId AS id FROM ReferralCodeAlias WHERE lower(code) = ${code} AND userId != ${userId}`;
  if (conflicts.length) throw Error("CODE_UNAVAILABLE");
  const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (before.referralCode && before.referralCode.toLowerCase() !== code) {
    await tx.referralCodeAlias.upsert({ where: { code: before.referralCode.toLowerCase() }, create: { code: before.referralCode.toLowerCase(), userId }, update: {} });
  }
  await tx.user.update({ where: { id: userId }, data: { referralCode: code } });
  return { code, previousCode: before.referralCode };
}
