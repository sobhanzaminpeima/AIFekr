import { resolvePeriod } from "./period";
import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";

export function subscriptionTerm(plan: string, period: string, duration: number) {
  if (plan === STUDENT_PLAN_CODE) return { months: 2, discount: 0, priceMultiplier: 1, days: 60 };
  if (plan.startsWith("CREDITS_")) return { months: 1, discount: 0, priceMultiplier: 1, days: duration };
  const { months, discount } = resolvePeriod(period);
  return { months, discount, priceMultiplier: months, days: duration * months };
}
