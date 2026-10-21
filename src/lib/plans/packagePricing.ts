import type { FxRates } from "@/lib/utils/currency";
/** Price bases are never mutated by currency conversion. TRY bases take priority. */
export function packageUsdPrice(plan: { price: number; priceUsd: number | null; priceTry?: number | null }, rates: FxRates): number {
  if (plan.priceTry != null) return plan.priceTry / 100 / rates.usdToTry;
  return plan.priceUsd != null ? plan.priceUsd / 100 : plan.price / 10 / rates.usdToToman;
}
export function convertedPackage<T extends { price: number; priceUsd: number | null; priceTry?: number | null }>(plan: T, rates: FxRates) {
  const usd = packageUsdPrice(plan, rates);
  return { ...plan, price: Math.round(usd * rates.usdToToman) * 10, priceUsd: Math.round(usd * 100), usdAmount: usd, liraAmount: plan.priceTry != null ? plan.priceTry / 100 : Math.round(usd * rates.usdToTry * 100) / 100, usdToTry: rates.usdToTry, rateDate: rates.rateDate, isFallback: rates.isFallback };
}
