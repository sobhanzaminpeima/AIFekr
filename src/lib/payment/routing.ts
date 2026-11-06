import { prisma } from "@/lib/db/prisma";
import { bankSettings, validIban } from "./bank";
import { zarinpalConfigured } from "./zarinpal";

/**
 * Which payment routes a buyer may use, decided on the server (the page used
 * to pick the currency from the site language alone):
 *  - toman through Zarinpal: a configured merchant, and an account whose
 *    country is Iran or whose language is Persian (an Iranian card is needed);
 *  - lira, euro or dollar by bank transfer (IBAN, confirmed by an admin): for
 *    anyone, when that IBAN is configured in the admin settings.
 * Switching the site language never adds a route the account is not eligible
 * for; the preferred route follows the country first, then the language.
 */
export type PayCurrency = "IRT" | "TRY" | "EUR" | "USD";
export type PayOption = { currency: PayCurrency; gateway: "zarinpal" | "bank_transfer" };

export async function paymentOptions(userId: string, siteLang?: string): Promise<{ options: PayOption[]; preferred: PayCurrency | null }> {
  const [user, zarinpal, bank] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { country: true, language: true } }),
    zarinpalConfigured().catch(() => false),
    bankSettings(),
  ]);
  const country = (user?.country || "").toUpperCase();
  const languages = new Set([siteLang, user?.language].filter(Boolean));
  const options: PayOption[] = [];
  if (zarinpal && (country === "IR" || languages.has("fa"))) options.push({ currency: "IRT", gateway: "zarinpal" });
  if (validIban(bank.iban)) options.push({ currency: "TRY", gateway: "bank_transfer" });
  if (validIban(bank.euroIban)) options.push({ currency: "EUR", gateway: "bank_transfer" }, { currency: "USD", gateway: "bank_transfer" });
  const has = (c: PayCurrency) => options.some((o) => o.currency === c);
  const lang = siteLang || user?.language || "";
  const preferred: PayCurrency | null =
    (country === "IR" || (!country && lang === "fa")) && has("IRT") ? "IRT"
    : (country === "TR" || lang === "tr") && has("TRY") ? "TRY"
    : lang === "fa" && has("IRT") ? "IRT"
    : has("USD") ? "USD" : has("TRY") ? "TRY" : has("IRT") ? "IRT" : null;
  return { options, preferred };
}

/** Whether a currency the client sent (quote: IRT/TRY/EUR/USD; checkout: IRR for toman) is one of the buyer's routes. */
export function allowedCurrency(options: PayOption[], currency: string) {
  const c = currency === "IRR" ? "IRT" : currency;
  return options.some((o) => o.currency === c);
}

export const PAYMENT_ROUTE_UNAVAILABLE = {
  fa: "این روش پرداخت برای حساب شما فعال نیست؛ روش دیگری را انتخاب کنید.",
  en: "This payment method isn't available for your account; please choose another.",
  de: "Diese Zahlungsart ist für Ihr Konto nicht verfügbar; bitte wählen Sie eine andere.",
  tr: "Bu ödeme yöntemi hesabın için kullanılamıyor; lütfen başka bir yöntem seç.",
} as const;
