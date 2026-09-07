import type { UiLocale } from "@/lib/i18n/foundation";

export interface LandingPlan {
  planCode: string; name: string; nameEn: string; price: number; priceUsd: number | null;
  credits: number; duration: number; isFeatured: boolean; market: string;
}
export type LandingCurrency = "IRR" | "USD";
export function planAmount(plan: LandingPlan, currency: LandingCurrency): number | null {
  const raw = currency === "IRR" ? plan.price : plan.priceUsd;
  if (raw === null || !Number.isFinite(raw) || raw < 0) return null;
  return currency === "IRR" ? raw / 10 : raw / 100;
}
export function formatAmount(amount: number, locale: UiLocale): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 2 }).format(amount);
}
export function registrationHref(planCode?: string): string {
  return !planCode || planCode === "FREE" ? "/register" : `/register?plan=${encodeURIComponent(planCode)}`;
}
