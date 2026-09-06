import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { formatListingPrice, describeDetails } from "@/lib/industry/realEstate/listingFormat";

/**
 * Section 2, item 5 — Pricing Advisor. Called out in the spec as the most
 * sensitive of the six agents (real money, owner trust) — three hard
 * requirements shape this file:
 *   1. Internal CRM data only — no external/live market feed exists on
 *      this platform, and this must be disclosed to the user honestly,
 *      not silently presented as if it were live market data.
 *   2. Suggestion only — this function never writes to the database or
 *      changes a property's price; it only returns advisory text.
 *   3. Always show reasoning, never just a number.
 */

interface ComparableProperty {
  title: string; price: bigint; currency: string; areaSqm: number | null; bedrooms: number | null; city: string | null;
}

const SYSTEM: Record<Lang, string> = {
  fa: `تو "مشاور قیمت‌گذاری" یک آژانس املاک هستی. فقط بر اساس داده‌های CRM داخلی همین آژانس (نه هیچ منبع بازار زنده یا خارجی) به کارشناس در مورد قیمت‌گذاری یک ملک مشاوره می‌دهی.
قوانین سخت‌گیرانه:
- هرگز ادعا نکن به داده بازار زنده یا خارجی دسترسی داری — فقط از ملک‌های مشابه ثبت‌شده در همین سیستم استفاده کن.
- اگر تعداد ملک‌های مشابه کم است (کمتر از ۳)، صریحاً این محدودیت را در پاسخ ذکر کن.
- این فقط یک پیشنهاد است، نه یک تصمیم قطعی — همیشه این را در پاسخ روشن کن.
- همیشه دلیل و استدلال بازه قیمتی پیشنهادی را توضیح بده، هرگز فقط یک عدد تنها نده.
- خروجی را دقیقاً به این فرمت JSON بده، بدون توضیح اضافه یا markdown:
{"priceRangeLow": عدد, "priceRangeHigh": عدد, "reasoning": "توضیح کامل استدلال به فارسی", "dataLimitation": "توضیح محدودیت داده (اگر داده کم بود) یا رشته خالی"}`,
  en: `You are the "Pricing Advisor" for a real-estate agency. You advise on pricing using ONLY this agency's own internal CRM data (no live or external market feed exists).
Strict rules:
- Never claim access to live or external market data — use only comparable properties already in this system.
- If there are few comparables (fewer than 3), explicitly state that limitation in the response.
- This is a suggestion only, never a final decision — make that clear in the response.
- Always explain the reasoning behind the suggested price range, never just a number.
- Return output in exactly this JSON format, no extra explanation or markdown:
{"priceRangeLow": number, "priceRangeHigh": number, "reasoning": "full reasoning in English", "dataLimitation": "limitation note (if data was thin) or empty string"}`,
  de: `Du bist der „Preisberater" einer Immobilienagentur. Du berätst zur Preisgestaltung AUSSCHLIESSLICH auf Basis der internen CRM-Daten dieser Agentur (es gibt keine Live- oder externe Marktanbindung).
Strikte Regeln:
- Behaupte niemals, Zugang zu Live- oder externen Marktdaten zu haben — nutze nur vergleichbare Objekte, die bereits in diesem System erfasst sind.
- Gibt es wenige Vergleichsobjekte (weniger als 3), benenne diese Einschränkung ausdrücklich in der Antwort.
- Das ist nur ein Vorschlag, niemals eine endgültige Entscheidung — mache das in der Antwort deutlich.
- Begründe die vorgeschlagene Preisspanne immer, gib niemals nur eine Zahl.
- Übernimm die Währung exakt so, wie sie in der Eingabe steht; rechne niemals um.
- Gib die Ausgabe exakt in diesem JSON-Format zurück, ohne zusätzliche Erklärung und ohne Markdown:
{"priceRangeLow": Zahl, "priceRangeHigh": Zahl, "reasoning": "vollständige Begründung auf Deutsch", "dataLimitation": "Hinweis auf Datenlage (falls dünn) oder leerer String"}`,
};

export interface PricingAdvice {
  priceRangeLow: number;
  priceRangeHigh: number;
  reasoning: string;
  dataLimitation: string;
  comparablesUsed: number;
}

export async function generatePricingAdvice(userId: string, propertyId: string, lang: Lang): Promise<PricingAdvice | null> {
  const property = await prisma.property.findFirst({ where: { id: propertyId, userId } });
  if (!property) return null;

  const comparables: ComparableProperty[] = await prisma.property.findMany({
    where: {
      userId,
      id: { not: propertyId },
      propertyType: property.propertyType,
      listingType: property.listingType,
      ...(property.city ? { city: property.city } : {}),
    },
    select: { title: true, price: true, currency: true, areaSqm: true, bedrooms: true, city: true },
    take: 20,
  });

  // Price and units go through the shared listing formatter so each comparable
  // carries its own currency. They previously rendered as a bare fa-IR/en-US
  // number with no currency at all, which invited the model to weigh a Lira
  // listing against a Toman one as though they were the same scale.
  const sep = tri(lang, "، ", ", ", ", ");
  const comparableLines = comparables.map((c) => {
    const details = describeDetails({ areaSqm: c.areaSqm, bedrooms: c.bedrooms }, lang);
    return `- ${c.title}: ${formatListingPrice(c.price, c.currency, lang)}${details ? `${sep}${details}` : ""}`;
  }).join("\n");

  const targetDetails = describeDetails({ areaSqm: property.areaSqm, bedrooms: property.bedrooms }, lang);
  const targetLine = `${tri(lang, "ملک هدف", "Target property", "Zielobjekt")}: ${property.title} — ${property.propertyType} — ${property.address}${property.city ? `${sep}${property.city}` : ""}${targetDetails ? ` — ${targetDetails}` : ""} — ${formatListingPrice(property.price, property.currency, lang)}`;

  const user = comparables.length > 0
    ? `${targetLine}\n\n${tri(lang, "ملک‌های مشابه ثبت‌شده در این آژانس", "Comparable properties on record at this agency", "Vergleichbare Objekte im Bestand dieser Agentur")} (${comparables.length}):\n${comparableLines}`
    : `${targetLine}\n\n${tri(lang, "هیچ ملک مشابهی در سیستم این آژانس ثبت نشده است.", "No comparable properties exist in this agency's system.", "Im System dieser Agentur sind keine vergleichbaren Objekte erfasst.")}`;

  let raw = "";
  await routedStreamChat([{ role: "user", content: user }], SYSTEM[lang], (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 1024);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      priceRangeLow: Number(parsed.priceRangeLow) || 0,
      priceRangeHigh: Number(parsed.priceRangeHigh) || 0,
      reasoning: String(parsed.reasoning || ""),
      dataLimitation: String(parsed.dataLimitation || (comparables.length < 3
        ? tri(lang,
            "تعداد ملک‌های مشابه در سیستم کم است؛ این پیشنهاد قابلیت اطمینان محدودی دارد.",
            "Few comparable properties in the system; this suggestion has limited reliability.",
            "Es sind nur wenige vergleichbare Objekte im System erfasst; dieser Vorschlag ist entsprechend wenig belastbar.")
        : "")),
      comparablesUsed: comparables.length,
    };
  } catch {
    return null;
  }
}
