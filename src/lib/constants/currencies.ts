// Currency list for the business onboarding form (and anywhere else a
// business-level currency must be picked from a closed list rather than typed
// freehand -- a stray "Toman" vs "IRT" vs "تومان" typo is unrecoverable data).
export interface CurrencyOption {
  code: string;
  fa: string;
  en: string;
  de: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", fa: "دلار آمریکا", en: "US Dollar", de: "US-Dollar", symbol: "$" },
  { code: "EUR", fa: "یورو", en: "Euro", de: "Euro", symbol: "€" },
  { code: "GBP", fa: "پوند انگلیس", en: "British Pound", de: "Britisches Pfund", symbol: "£" },
  { code: "IRR", fa: "ریال ایران", en: "Iranian Rial", de: "Iranischer Rial", symbol: "﷼" },
  { code: "IRT", fa: "تومان ایران", en: "Iranian Toman", de: "Iranischer Toman", symbol: "تومان" },
  { code: "TRY", fa: "لیر ترکیه", en: "Turkish Lira", de: "Türkische Lira", symbol: "₺" },
  { code: "AED", fa: "درهم امارات", en: "UAE Dirham", de: "VAE-Dirham", symbol: "د.إ" },
  { code: "SAR", fa: "ریال سعودی", en: "Saudi Riyal", de: "Saudi-Riyal", symbol: "﷼" },
  { code: "CHF", fa: "فرانک سوئیس", en: "Swiss Franc", de: "Schweizer Franken", symbol: "CHF" },
  { code: "CAD", fa: "دلار کانادا", en: "Canadian Dollar", de: "Kanadischer Dollar", symbol: "$" },
  { code: "AUD", fa: "دلار استرالیا", en: "Australian Dollar", de: "Australischer Dollar", symbol: "$" },
];

export function currencyLabel(code: string | null | undefined, lang: "fa" | "en" | "de" | "tr"): string {
  const c = CURRENCIES.find((x) => x.code === code);
  if (!c) return code || "";
  return lang === "fa" ? c.fa : lang === "de" ? c.de : c.en;
}
