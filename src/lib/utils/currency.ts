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

export interface FxRates {
  usdToToman: number;
  usdToEur: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — FX rates don't need to be second-fresh for pack pricing display
let cache: { rates: FxRates; fetchedAt: number } | null = null;

async function fetchLiveRates(): Promise<FxRates> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`FX API ${res.status}`);
  const data = await res.json();
  if (data.result !== "success" || !data.rates?.IRR || !data.rates?.EUR) throw new Error("FX API malformed response");
  // open.er-api.com's IRR rate is Iran's official Rial-per-USD figure — divide
  // by 10 for Toman (the everyday colloquial unit this app prices in).
  return { usdToToman: data.rates.IRR / 10, usdToEur: data.rates.EUR };
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
    return { usdToToman: USD_TO_TOMAN_FALLBACK, usdToEur: USD_TO_EUR_FALLBACK };
  }
}

/** Synchronous formatter for callers that already have rates (e.g. client components that fetched /api/fx-rate once). */
export function formatPackPriceSync(usd: number, lang: "fa" | "en" | "de", rates: FxRates): string {
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
  return `$${usd.toLocaleString("en-US")}`;
}

/** Async formatter for server components — fetches (cached) live rates internally. */
export async function formatPackPrice(usd: number, lang: "fa" | "en" | "de"): Promise<string> {
  const rates = await getFxRates();
  return formatPackPriceSync(usd, lang, rates);
}
