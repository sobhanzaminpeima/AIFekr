"use client";

export type Currency = "USD" | "EUR" | "IRR" | "AED" | "GBP";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  IRR: "﷼",
  AED: "د.إ",
  GBP: "£",
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: "دلار",
  EUR: "یورو",
  IRR: "ریال",
  AED: "درهم",
  GBP: "پوند",
};

// Default rates (will be overridden by admin settings)
export const DEFAULT_RATES: Record<string, number> = {
  usd_to_irr: 600000,
  usd_to_aed: 3.67,
  usd_to_eur: 0.92,
  usd_to_gbp: 0.79,
};

export function convertPrice(usdPrice: number, currency: Currency, rates: Record<string, number> = DEFAULT_RATES): number {
  switch (currency) {
    case "IRR": return Math.round(usdPrice * (rates.usd_to_irr ?? DEFAULT_RATES.usd_to_irr));
    case "AED": return Math.round(usdPrice * (rates.usd_to_aed ?? DEFAULT_RATES.usd_to_aed) * 100) / 100;
    case "EUR": return Math.round(usdPrice * (rates.usd_to_eur ?? DEFAULT_RATES.usd_to_eur) * 100) / 100;
    case "GBP": return Math.round(usdPrice * (rates.usd_to_gbp ?? DEFAULT_RATES.usd_to_gbp) * 100) / 100;
    default: return usdPrice;
  }
}

export function formatPrice(usdPrice: number, currency: Currency, rates?: Record<string, number>): string {
  const converted = convertPrice(usdPrice, currency, rates);
  const symbol = CURRENCY_SYMBOLS[currency];
  if (currency === "IRR") {
    return `${converted.toLocaleString("fa-IR")} ${symbol}`;
  }
  return `${symbol}${converted}`;
}

export function getCurrency(): Currency {
  if (typeof document === "undefined") return "USD";
  const match = document.cookie.match(/(?:^|;\s*)currency=([^;]*)/);
  const val = match ? match[1] : null;
  return (val && ["USD", "EUR", "IRR", "AED", "GBP"].includes(val)) ? (val as Currency) : "USD";
}

export function setCurrency(c: Currency) {
  document.cookie = `currency=${c}; path=/; max-age=31536000`;
}
