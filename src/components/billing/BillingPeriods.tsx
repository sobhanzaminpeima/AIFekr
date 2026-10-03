"use client";

import { PERIOD_DISCOUNT, type BillingPeriod } from "@/lib/payment/period";
import { text, type Copy } from "@/lib/marketing/catalog";
import type { Lang } from "@/lib/i18n/server";

export const PURCHASE_PERIODS: BillingPeriod[] = ["monthly", "quarterly", "semiannual"];
export const PERIOD_LABELS: Record<BillingPeriod, Copy> = {
  monthly: ["۱ ماهه", "1 month", "1 Monat", "1 aylık"],
  quarterly: ["۳ ماهه", "3 months", "3 Monate", "3 aylık"],
  semiannual: ["۶ ماهه", "6 months", "6 Monate", "6 aylık"],
  annual: ["سالانه", "Annual", "Jährlich", "Yıllık"],
};

export default function BillingPeriods({ lang, value, onChange, disabled = false }: {
  lang: Lang; value: BillingPeriod; onChange: (value: BillingPeriod) => void; disabled?: boolean;
}) {
  return <div className="billing-periods" role="group" aria-label={text(lang, ["دورهٔ اشتراک", "Subscription term", "Abonnementlaufzeit", "Abonelik süresi"])}>
    {PURCHASE_PERIODS.map(period => <button type="button" key={period} disabled={disabled} aria-pressed={value === period} onClick={() => onChange(period)}>
      {text(lang, PERIOD_LABELS[period])}
      {PERIOD_DISCOUNT[period] > 0 && <small>{Math.round(PERIOD_DISCOUNT[period] * 100).toLocaleString(lang)}٪</small>}
    </button>)}
  </div>;
}
