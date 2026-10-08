"use client";
import { useTranslation, tri } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/constants/countries";
const normalizeCountry = (name: string) => name.replace(/\band\b/gi, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
const regionCodes = new Map<string, string>();
const englishRegions = new Intl.DisplayNames(["en"], { type: "region" });
for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
  const code = String.fromCharCode(first, second);
  const name = englishRegions.of(code);
  if (name && name !== code) regionCodes.set(normalizeCountry(name), code);
}
type Market = { location_code: number; location_name: string; available_languages: { language_code: string; language_name: string }[] };
export default function SeoMarketFields({ markets, locationCode, languageCode, device, rank, busy, onLocation, onLanguage, onDevice }: { markets: Market[]; locationCode: string; languageCode: string; device: string; rank: boolean; busy: boolean; onLocation: (value: string) => void; onLanguage: (value: string) => void; onDevice: (value: string) => void }) {
  const { lang } = useTranslation(); const text = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 focus:outline-none focus:ring-2 focus:ring-orange-400";
  const countries = new Intl.DisplayNames([lang], { type: "region" });
  const languageNames = new Intl.DisplayNames([lang], { type: "language" });
  const countryName = (name: string) => {
    const known = COUNTRIES.find(country => country.en === name || (name === "Turkiye" && country.code === "TR"));
    const code = known?.code || regionCodes.get(normalizeCountry(name));
    return code ? countries.of(code) || name : name;
  };
  const languages = markets.find(market => String(market.location_code) === locationCode)?.available_languages || [];
  function chooseLocation(value: string) { onLocation(value); const available = markets.find(market => String(market.location_code) === value)?.available_languages || []; if (!available.some(language => language.language_code === languageCode) && available[0]) onLanguage(available[0].language_code); }
  return <div className="grid gap-3 sm:grid-cols-3"><label className="block space-y-2 text-sm"><span>{text("کشور بازار هدف", "Target market", "Zielmarkt", "Hedef pazar")}</span>{markets.length ? <select disabled={busy} className={field} value={locationCode} onChange={e => chooseLocation(e.target.value)}>{markets.map(market => <option key={market.location_code} value={market.location_code}>{countryName(market.location_name)}</option>)}</select> : <input disabled={busy} type="number" min="1" className={field} value={locationCode} onChange={e => onLocation(e.target.value)} />}</label><label className="block space-y-2 text-sm"><span>{text("زبان جست‌وجو", "Search language", "Suchsprache", "Arama dili")}</span>{languages.length ? <select disabled={busy} className={field} value={languageCode} onChange={e => onLanguage(e.target.value)}>{languages.map(language => <option key={language.language_code} value={language.language_code}>{languageNames.of(language.language_code) || language.language_name}</option>)}</select> : <input disabled={busy} className={field} value={languageCode} onChange={e => onLanguage(e.target.value)} maxLength={5} />}</label>{rank && <label className="block space-y-2 text-sm"><span>{text("دستگاه", "Device", "Gerät", "Cihaz")}</span><select disabled={busy} className={field} value={device} onChange={e => onDevice(e.target.value)}><option value="desktop">{text("کامپیوتر", "Desktop", "Desktop", "Masaüstü")}</option><option value="mobile">{text("موبایل", "Mobile", "Mobil", "Mobil")}</option></select></label>}</div>;
}
