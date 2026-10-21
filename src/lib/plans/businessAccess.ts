import { prisma } from "@/lib/db/prisma";
import { BUSINESS_CODES } from "./business";
/** Paid workspace capabilities; an expired plan or unrelated team never qualifies. */
export async function hasBusinessBundle(userId: string): Promise<boolean> {
  const payment = await prisma.payment.findFirst({
    where: {
      status: "SUCCESS", gateway: { in: ["bank_transfer", "zarinpal"] }, plan: { in: BUSINESS_CODES },
      user: { plan: "TEAM", planExpiry: { gt: new Date() }, OR: [
        { id: userId }, { ownedTeam: { members: { some: { userId } } } },
      ] },
    }, select: { id: true },
  });
  return !!payment;
}
