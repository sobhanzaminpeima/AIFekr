import { prisma } from "@/lib/db/prisma";
import { STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE } from "@/lib/plans/studentOffer";
import { getFxRates } from "@/lib/utils/currency";
import { convertedPackage } from "@/lib/plans/packagePricing";
export async function getStudentPackage() {
  try {
    const rows = await prisma.package.findMany({ where: { planCode: { in: [STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE] }, isActive: true }, select: { planCode: true, price: true, priceUsd: true, priceTry: true, credits: true, isActive: true } });
    const plan = rows.find(p => p.planCode === STUDENT_PLAN_CODE);
    if (!plan) return null;
    const rates = await getFxRates();
    const monthly = rows.find(p => p.planCode === STUDENT_MONTHLY_CODE);
    return { ...convertedPackage(plan, rates), monthlyPackage: monthly ? convertedPackage(monthly, rates) : null };
  } catch { return null; }
}
