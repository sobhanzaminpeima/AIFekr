"use client";

import { useTranslation, type Lang } from "@/lib/i18n";

/**
 * Shared locale/format helper for the accounting module.
 *
 * Before this existed, all ten accounting pages hardcoded three things that
 * broke every non-Persian user:
 *   - `dir="rtl"` on the page root, so an English/German user got a
 *     right-to-left layout with left-to-right text;
 *   - `toLocaleString("fa-IR")`, so every amount rendered in Persian digits
 *     regardless of who was reading it or what currency it was in;
 *   - Persian-only UI strings with no translation mechanism at all.
 *
 * Digit rule (the important one): Persian digits are used ONLY when the
 * reader's UI language is Persian AND the amount is in an Iranian currency.
 * That covers both halves of the real complaint this fixes:
 *   - a Turkish-lira owner statement must never render "۱۸٬۵۰۰" just because
 *     the admin happens to browse in Persian (currency decides, not language);
 *   - a Toman amount must never render in Persian digits for an admin reading
 *     the English UI (language decides too).
 * When the currency is unknown (dashboards that aggregate a workspace's base
 * currency), language alone decides — the safest available signal.
 */

const IRANIAN_CURRENCIES = new Set(["IRT", "IRR"]);

export interface AccountingLocale {
  lang: Lang;
  /** "rtl" for Persian, "ltr" for English/German — feed straight into dir={...}. */
  dir: "rtl" | "ltr";
  isFa: boolean;
  /** Formats an amount. Pass the record's currency whenever you know it. */
  fmtNum: (n: number, currency?: string | null) => string;
  /** Formats a date in the reader's calendar/locale. */
  fmtDate: (d: string | Date, currency?: string | null) => string;
  /** Month + year, e.g. for statement/payroll period headers. */
  fmtMonth: (d: string | Date, currency?: string | null) => string;
}

function localeFor(lang: Lang, currency?: string | null): string {
  const persianDigits = lang === "fa" && (currency == null || IRANIAN_CURRENCIES.has(currency));
  if (persianDigits) return "fa-IR";
  return lang === "de" ? "de-DE" : "en-US";
}

export function useAccountingLocale(): AccountingLocale {
  const { lang } = useTranslation();
  return {
    lang,
    dir: lang === "fa" ? "rtl" : "ltr",
    isFa: lang === "fa",
    fmtNum: (n, currency) => Math.round(n).toLocaleString(localeFor(lang, currency)),
    fmtDate: (d, currency) => new Date(d).toLocaleDateString(localeFor(lang, currency)),
    fmtMonth: (d, currency) =>
      new Date(d).toLocaleDateString(localeFor(lang, currency), { year: "numeric", month: "long" }),
  };
}
