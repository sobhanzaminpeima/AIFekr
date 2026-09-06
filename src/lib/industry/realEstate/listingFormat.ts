// Shared formatting for the strings we hand to the LLM when it writes listing
// copy (Instagram / Divar / website).
//
// Two defects this exists to close:
//
//  1. The price used to be hardcoded as "Toman" with fa-IR numerals in every
//     branch — including the English one. Since properties can be priced in
//     TRY/EUR/USD/GBP, a Turkish agent's listing was being described to the
//     model as Toman, and the model dutifully published the wrong currency.
//     Price text now follows `property.currency`, never the UI language.
//
//  2. The English prompts embedded Persian units ("متر", "خوابه", "سرویس"),
//     so an English caption was being generated from half-Persian input.

import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

const IRANIAN = new Set(["IRT", "IRR"]);

const CURRENCY_WORD: Record<string, Record<Lang, string>> = {
  IRT: { fa: "تومان", en: "Toman", de: "Toman" },
  IRR: { fa: "ریال", en: "Rial", de: "Rial" },
  USD: { fa: "دلار", en: "USD", de: "USD" },
  GBP: { fa: "پوند", en: "GBP", de: "GBP" },
  EUR: { fa: "یورو", en: "EUR", de: "EUR" },
  TRY: { fa: "لیر", en: "TRY", de: "TRY" },
};

/**
 * Numerals follow the CURRENCY, not the reader — Persian digits only for
 * Iranian currencies, matching the rule the accounting module already uses.
 */
export function formatListingPrice(price: bigint | number, currency: string, lang: Lang): string {
  const code = (currency || "IRT").toUpperCase();
  const locale = IRANIAN.has(code) && lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const amount = Number(price).toLocaleString(locale);
  const word = CURRENCY_WORD[code]?.[lang] ?? code;
  return `${amount} ${word}`;
}

/** "110 sqm, 2 bedrooms, 1 bathroom" in the requested language. */
export function describeDetails(
  p: { areaSqm: number | null; bedrooms: number | null; bathrooms?: number | null },
  lang: Lang,
): string {
  const parts = [
    p.areaSqm ? tri(lang, `متراژ ${p.areaSqm} متر`, `${p.areaSqm} sqm`, `${p.areaSqm} m²`) : null,
    p.bedrooms ? tri(lang, `${p.bedrooms} خوابه`, `${p.bedrooms} bedrooms`, `${p.bedrooms} Schlafzimmer`) : null,
    p.bathrooms ? tri(lang, `${p.bathrooms} سرویس`, `${p.bathrooms} bathrooms`, `${p.bathrooms} Badezimmer`) : null,
  ].filter(Boolean);
  return parts.join(tri(lang, "، ", ", ", ", "));
}
