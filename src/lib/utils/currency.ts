// IndustryPack.price is stored in USD (the base currency the packs were
// authored in — see prisma/seed.ts). Convert to the viewer's local currency:
// fa -> Toman, de -> EUR, en -> USD unchanged. Rates are env-overridable
// since FX rates drift; defaults are a reasonable fallback, not live-market.
const USD_TO_TOMAN = Number(process.env.USD_TO_TOMAN_RATE) || 650000;
const USD_TO_EUR = Number(process.env.USD_TO_EUR_RATE) || 0.92;

export function formatPackPrice(usd: number, lang: "fa" | "en" | "de"): string {
  if (lang === "fa") {
    const toman = Math.round((usd * USD_TO_TOMAN) / 1000) * 1000;
    return `${toman.toLocaleString("fa-IR")} تومان`;
  }
  if (lang === "de") {
    const eur = Math.round(usd * USD_TO_EUR);
    return `€${eur.toLocaleString("de-DE")}`;
  }
  return `$${usd.toLocaleString("en-US")}`;
}
