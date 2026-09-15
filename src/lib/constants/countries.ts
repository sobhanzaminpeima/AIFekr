// Shared country list for registration and the admin panel — ISO 3166-1
// alpha-2 codes as the stored value, trilingual labels for display. Not
// exhaustive (195 countries) on purpose: covers Iran/the region plus the
// markets AiFekr actually sees signups from, with an explicit "Other" for
// everyone else rather than a wall of countries nobody here is from.
export interface CountryOption {
  code: string;
  fa: string;
  en: string;
  de: string;
  /** No dedicated Turkish country names yet -- countryLabel() falls back to `en`. */
  tr?: string;
  /** E.164 country calling code, e.g. "+98". Empty for "Other" -- no single dial code applies. */
  dialCode: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: "IR", fa: "ایران", en: "Iran", de: "Iran", dialCode: "+98" },
  { code: "AF", fa: "افغانستان", en: "Afghanistan", de: "Afghanistan", dialCode: "+93" },
  { code: "TJ", fa: "تاجیکستان", en: "Tajikistan", de: "Tadschikistan", dialCode: "+992" },
  { code: "TR", fa: "ترکیه", en: "Turkey", de: "Türkei", dialCode: "+90" },
  { code: "CY", fa: "قبرس", en: "Cyprus", de: "Zypern", dialCode: "+357" },
  { code: "AE", fa: "امارات متحده عربی", en: "United Arab Emirates", de: "Vereinigte Arabische Emirate", dialCode: "+971" },
  { code: "IQ", fa: "عراق", en: "Iraq", de: "Irak", dialCode: "+964" },
  { code: "SA", fa: "عربستان سعودی", en: "Saudi Arabia", de: "Saudi-Arabien", dialCode: "+966" },
  { code: "QA", fa: "قطر", en: "Qatar", de: "Katar", dialCode: "+974" },
  { code: "KW", fa: "کویت", en: "Kuwait", de: "Kuwait", dialCode: "+965" },
  { code: "OM", fa: "عمان", en: "Oman", de: "Oman", dialCode: "+968" },
  { code: "DE", fa: "آلمان", en: "Germany", de: "Deutschland", dialCode: "+49" },
  { code: "AT", fa: "اتریش", en: "Austria", de: "Österreich", dialCode: "+43" },
  { code: "CH", fa: "سوئیس", en: "Switzerland", de: "Schweiz", dialCode: "+41" },
  { code: "GB", fa: "بریتانیا", en: "United Kingdom", de: "Vereinigtes Königreich", dialCode: "+44" },
  { code: "FR", fa: "فرانسه", en: "France", de: "Frankreich", dialCode: "+33" },
  { code: "NL", fa: "هلند", en: "Netherlands", de: "Niederlande", dialCode: "+31" },
  { code: "SE", fa: "سوئد", en: "Sweden", de: "Schweden", dialCode: "+46" },
  { code: "IT", fa: "ایتالیا", en: "Italy", de: "Italien", dialCode: "+39" },
  { code: "ES", fa: "اسپانیا", en: "Spain", de: "Spanien", dialCode: "+34" },
  { code: "US", fa: "ایالات متحده آمریکا", en: "United States", de: "Vereinigte Staaten", dialCode: "+1" },
  { code: "CA", fa: "کانادا", en: "Canada", de: "Kanada", dialCode: "+1" },
  { code: "AU", fa: "استرالیا", en: "Australia", de: "Australien", dialCode: "+61" },
  { code: "OTHER", fa: "سایر", en: "Other", de: "Andere", dialCode: "" },
];

export function dialCodeFor(countryCode: string | null | undefined): string {
  return COUNTRIES.find((c) => c.code === countryCode)?.dialCode || "";
}

export function countryLabel(code: string | null | undefined, lang: "fa" | "en" | "de" | "tr"): string {
  const c = COUNTRIES.find((c) => c.code === code);
  if (!c) return code || "";
  return c[lang] ?? c.en;
}
