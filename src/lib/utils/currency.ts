// IndustryPack.price is stored in USD (the base currency the packs were
// authored in — see prisma/seed.ts). Convert to the viewer's local currency:
// fa -> Toman/Rial, de -> EUR, en -> USD unchanged.
//
// Rates come from a live FX API (open.er-api.com — free, no key required),
// cached in-memory for CACHE_TTL_MS so we're not hitting it on every page
// render. On fetch failure, or before the first successful fetch, we fall
// back to the last known-good cached rate; if there's never been one yet
// (e.g. cold start with the API down), we fall back to the env-var/hardcoded
// defaults below — so pricing always renders something reasonable, never an
// error, even if the FX API is unreachable.

const USD_TO_TOMAN_FALLBACK = Number(process.env.USD_TO_TOMAN_RATE) || 650000;
const USD_TO_EUR_FALLBACK = Number(process.env.USD_TO_EUR_RATE) || 0.92;
const USD_TO_TRY_FALLBACK = Number(process.env.USD_TO_TRY_RATE) || 34;

export interface FxRates {
  usdToToman: number;
  usdToEur: number;
  usdToTry: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — FX rates don't need to be second-fresh for pack pricing display
let cache: { rates: FxRates; fetchedAt: number } | null = null;

/**
 * freecurrencyapi.com doesn't cover IRR (Iran is excluded from most FX
 * providers), so it can only ever refine the EUR leg — TRY and the IRR-based
 * Toman rate always come from open.er-api.com. Treated as a best-effort
 * upgrade: on any failure (missing key, quota, network) we silently keep
 * open.er-api's EUR figure instead of throwing, since that's already a
 * perfectly usable rate on its own.
 */
async function fetchFreeCurrencyApiEur(): Promise<number | null> {
  const apiKey = process.env.FREECURRENCY_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.freecurrencyapi.com/v1/latest?apikey=${apiKey}&base_currency=USD&currencies=EUR`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.data?.EUR === "number" ? data.data.EUR : null;
  } catch {
    return null;
  }
}

async function fetchLiveRates(): Promise<FxRates> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`FX API ${res.status}`);
  const data = await res.json();
  if (data.result !== "success" || !data.rates?.IRR || !data.rates?.EUR || !data.rates?.TRY) throw new Error("FX API malformed response");
  // open.er-api.com's IRR rate is Iran's official Rial-per-USD figure — divide
  // by 10 for Toman (the everyday colloquial unit this app prices in).
  const freeCurrencyEur = await fetchFreeCurrencyApiEur();
  return { usdToToman: data.rates.IRR / 10, usdToEur: freeCurrencyEur ?? data.rates.EUR, usdToTry: data.rates.TRY };
}

/** Cached live FX rates, safe to call on every request — only actually hits the network once per CACHE_TTL_MS. */
export async function getFxRates(): Promise<FxRates> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.rates;

  try {
    const rates = await fetchLiveRates();
    cache = { rates, fetchedAt: now };
    return rates;
  } catch (err) {
    console.error("FX rate fetch failed, using fallback:", err);
    // Keep serving the last known-good cached value past its TTL rather than
    // reverting to the static default the moment the API has one bad request.
    if (cache) return cache.rates;
    return { usdToToman: USD_TO_TOMAN_FALLBACK, usdToEur: USD_TO_EUR_FALLBACK, usdToTry: USD_TO_TRY_FALLBACK };
  }
}

/** Synchronous formatter for callers that already have rates (e.g. client components that fetched /api/fx-rate once). */
export function formatPackPriceSync(usd: number, lang: "fa" | "en" | "de" | "tr", rates: FxRates): string {
  if (lang === "fa") {
    // Rial = Toman * 10 (Iran's official currency unit; Toman is the everyday
    // colloquial unit). Rounded to the nearest 10,000 Rial for a clean number.
    const rial = Math.round((usd * rates.usdToToman * 10) / 10000) * 10000;
    return `${rial.toLocaleString("fa-IR")} ریال`;
  }
  if (lang === "de") {
    const eur = Math.round(usd * rates.usdToEur);
    return `€${eur.toLocaleString("de-DE")}`;
  }
  if (lang === "tr") {
    const lira = Math.round(usd * rates.usdToTry);
    return `₺${lira.toLocaleString("tr-TR")}`;
  }
  return `$${usd.toLocaleString("en-US")}`;
}

/** Async formatter for server components — fetches (cached) live rates internally. */
export async function formatPackPrice(usd: number, lang: "fa" | "en" | "de" | "tr"): Promise<string> {
  const rates = await getFxRates();
  return formatPackPriceSync(usd, lang, rates);
}
