import { resolvePeriod } from "./period";
import { STUDENT_PLAN_CODE, LEGACY_STUDENT_PLAN_CODE, STUDENT_OFFER, STUDENT_MONTHLY_CODE } from "@/lib/plans/studentOffer";

export function subscriptionTerm(plan: string, period: string, duration: number) {
  if (plan === STUDENT_PLAN_CODE) return { months: STUDENT_OFFER.months, discount: 0, priceMultiplier: 1, days: STUDENT_OFFER.days };
  if (plan === "STUDENT_FIRST_THREE_MONTHS") return { months: 3, discount: 0, priceMultiplier: 1, days: 90 };
  if (plan === STUDENT_MONTHLY_CODE) return { months: 1, discount: 0, priceMultiplier: 1, days: 30 };
  if (plan === LEGACY_STUDENT_PLAN_CODE) return { months: 2, discount: 0, priceMultiplier: 1, days: 60 };
  if (plan.startsWith("CREDITS_")) return { months: 1, discount: 0, priceMultiplier: 1, days: duration };
  const { months, discount } = resolvePeriod(period);
  return { months, discount, priceMultiplier: months, days: duration * months };
}
