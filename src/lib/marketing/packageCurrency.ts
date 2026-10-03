import type { Lang } from "@/lib/i18n/server";
import type { FxRates } from "@/lib/utils/currency";

export function packageCurrency(lang: Lang) {
  return lang === "fa" ? "IRT" : lang === "tr" ? "TRY" : "USD";
}

export function packageAmount(usd: number, lang: Lang, rates?: Pick<FxRates, "usdToToman" | "usdToTry">) {
  return usd * (lang === "fa" ? rates?.usdToToman ?? 163399.625272 : lang === "tr" ? rates?.usdToTry ?? 49.123297 : 1);
}

export function formatPackageAmount(amount: number, lang: Lang) {
  return lang === "fa"
    ? `${Math.round(amount).toLocaleString("fa-IR")} تومان`
    : new Intl.NumberFormat(lang, { style: "currency", currency: packageCurrency(lang), maximumFractionDigits: 2 }).format(amount);
}
