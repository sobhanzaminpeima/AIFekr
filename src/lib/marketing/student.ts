import { prisma } from "@/lib/db/prisma";
import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";
import { getFxRates } from "@/lib/utils/currency";
export async function getStudentPackage() {
  try {
  const plan = await prisma.package.findUnique({ where: { planCode: STUDENT_PLAN_CODE }, select: { planCode: true, price: true, priceUsd: true, credits: true, isActive: true } });
  if (!plan?.isActive || (plan.priceUsd ?? 0) <= 0) return null;
  const rates = await getFxRates();
  return { ...plan, price: Math.round((plan.priceUsd ?? 0) / 100 * rates.usdToToman) * 10, usdToTry: rates.usdToTry, rateDate: rates.rateDate, isFallback: rates.isFallback };
  } catch { return null; }
}
