import { PERIOD_DISCOUNT, PERIOD_MONTHS, type BillingPeriod } from "@/lib/payment/period";
/** Matches payment/create rounding in the selected market. Null is not free. */
export function periodPrice(base: number, period: BillingPeriod, lang: string): number {
  const value = base * PERIOD_MONTHS[period] * (1 - PERIOD_DISCOUNT[period]);
  return lang === "fa" ? Math.round(value) : Math.round(value * 100) / 100;
}
