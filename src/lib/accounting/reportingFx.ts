// Currency conversion for accounting reports.
//
// Deliberately separate from src/lib/utils/currency.ts. That module exists to
// price marketing packages: it caches for 12 hours, silently falls back to a
// hardcoded rate when the API is down, and returns no date. Those are all fine
// for a pricing page and all wrong for a document someone gives their landlord
// or their tax inspector.
//
// The rules here are the ones a real accounting system follows:
//
//   1. The amount in the currency it was RECORDED in is always shown. The
//      converted figure is additional information, never a replacement.
//   2. Every conversion carries the rate, the date the rate is from, and who
//      published it — printed on the document, so the number can be checked.
//   3. If no rate is available, nothing is converted. The report says the
//      conversion is unavailable rather than guessing, because a plausible
//      wrong number in a financial statement is worse than an absent one.

/** ISO codes the accounting module deals in, plus Toman, which is not ISO. */
export const REPORT_CURRENCIES = ["IRT", "IRR", "USD", "EUR", "GBP", "TRY"] as const;
export type ReportCurrency = (typeof REPORT_CURRENCIES)[number];

export interface FxSnapshot {
  /** Rates expressed as: 1 USD = rates[code]. */
  rates: Record<string, number>;
  /** The provider's own last-update time — NOT the time we happened to fetch. */
  asOf: Date;
  provider: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h. The snapshot carries its own asOf, so caching never misstates the date.
let cache: { snap: FxSnapshot; fetchedAt: number } | null = null;

/**
 * Returns null when a rate genuinely cannot be established. Callers must treat
 * null as "do not convert" — there is no fallback rate on purpose.
 */
export async function getFxSnapshot(): Promise<FxSnapshot | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.snap;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`FX API ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates?.IRR) throw new Error("FX API malformed response");

    const rates: Record<string, number> = { ...data.rates };
    // Toman is the everyday Iranian unit and is not an ISO code: 1 Toman = 10 Rial.
    rates.IRT = data.rates.IRR / 10;

    const snap: FxSnapshot = {
      rates,
      asOf: new Date(data.time_last_update_utc || Date.now()),
      provider: data.provider || "open.er-api.com",
    };
    cache = { snap, fetchedAt: Date.now() };
    return snap;
  } catch (err) {
    console.error("Reporting FX unavailable — reports will not convert:", err);
    // A stale snapshot is still honest, because it states its own asOf date.
    return cache?.snap ?? null;
  }
}

export interface Converted {
  value: number;
  /** How many units of `to` one unit of `from` buys, at `asOf`. */
  rate: number;
}

/** Converts via USD. Returns null if either currency has no rate in the snapshot. */
export function convert(amount: number, from: string, to: string, snap: FxSnapshot): Converted | null {
  if (from === to) return { value: amount, rate: 1 };
  const fromRate = snap.rates[from];
  const toRate = snap.rates[to];
  if (!fromRate || !toRate) return null;
  const rate = toRate / fromRate;
  return { value: amount * rate, rate };
}

/**
 * Formats an amount for a report. Numerals follow the CURRENCY, not the
 * reader — Persian digits only for an Iranian currency read in Persian, the
 * same rule the rest of the platform uses.
 */
export function formatReportAmount(amount: number, currency: string, lang: "fa" | "en" | "de"): string {
  const iranian = currency === "IRT" || currency === "IRR";
  const locale = iranian && lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const word = CURRENCY_WORD[currency]?.[lang] ?? currency;
  return `${Math.round(amount).toLocaleString(locale)} ${word}`;
}

const CURRENCY_WORD: Record<string, Record<"fa" | "en" | "de", string>> = {
  IRT: { fa: "تومان", en: "Toman", de: "Toman" },
  IRR: { fa: "ریال", en: "Rial", de: "Rial" },
  USD: { fa: "دلار", en: "USD", de: "USD" },
  EUR: { fa: "یورو", en: "EUR", de: "EUR" },
  GBP: { fa: "پوند", en: "GBP", de: "GBP" },
  TRY: { fa: "لیر", en: "TRY", de: "TRY" },
};

/**
 * The disclosure line that must appear on any report carrying a converted
 * figure. Without it the converted number is an unsourced claim: it depends
 * entirely on which day's rate was used, and next week it would be different.
 */
export function rateDisclosure(
  from: string,
  to: string,
  rate: number,
  snap: FxSnapshot,
  lang: "fa" | "en" | "de",
): string {
  const date = snap.asOf.toISOString().slice(0, 10);
  const r = rate.toLocaleString(lang === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 6 });
  if (lang === "fa") {
    return `مبالغ به ${CURRENCY_WORD[to]?.fa ?? to} تبدیل شده‌اند: ۱ ${CURRENCY_WORD[from]?.fa ?? from} = ${r} ${CURRENCY_WORD[to]?.fa ?? to}، نرخ تاریخ ${date} از ${snap.provider}. مبلغ ثبت‌شدهٔ اصلی در ستون اول است و مرجع همان است.`;
  }
  if (lang === "de") {
    return `Beträge wurden in ${to} umgerechnet: 1 ${from} = ${r} ${to}, Kurs vom ${date}, Quelle ${snap.provider}. Maßgeblich bleibt der ursprünglich erfasste Betrag in der ersten Spalte.`;
  }
  return `Amounts converted to ${to} at 1 ${from} = ${r} ${to}, rate dated ${date}, source ${snap.provider}. The originally recorded amount in the first column is the authoritative one.`;
}

/** Shown instead of converted figures when no rate could be established. */
export function conversionUnavailable(lang: "fa" | "en" | "de"): string {
  if (lang === "fa") return "نرخ ارز در دسترس نبود، بنابراین مبالغ تبدیل نشده‌اند و به ارز اصلی نمایش داده می‌شوند.";
  if (lang === "de") return "Es war kein Wechselkurs verfügbar; die Beträge wurden daher nicht umgerechnet und erscheinen in der Ursprungswährung.";
  return "No exchange rate was available, so amounts have not been converted and appear in their original currency.";
}

/**
 * The currency this workspace's books are effectively kept in.
 *
 * There is no workspace-level currency setting: the ledger stores plain
 * numbers, and `@default("IRT")` is what every currency-bearing row falls back
 * to. Rather than hardcode that assumption into reports, this reads the
 * currency the workspace actually uses on its bank accounts — the closest
 * thing the data has to "the books' currency" — and only then falls back to
 * the system default.
 */
export async function getWorkspaceCurrency(workspaceUserId: string): Promise<string> {
  const { prisma } = await import("@/lib/db/prisma");
  try {
    const grouped = await prisma.accountingBankAccount.groupBy({
      by: ["currency"],
      where: { workspaceUserId },
      _count: { currency: true },
      orderBy: { _count: { currency: "desc" } },
      take: 1,
    });
    return grouped[0]?.currency || "IRT";
  } catch {
    return "IRT";
  }
}
