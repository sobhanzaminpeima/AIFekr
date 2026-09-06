import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { registerSocialContentPack, type GeneratedSocialPost } from "../registry";
import { tri } from "@/lib/i18n/tri";
import type { PromptLang } from "@/lib/instagram";
import { formatListingPrice, describeDetails } from "./listingFormat";

const LISTING_TYPE_LABEL_FA: Record<string, string> = { buy: "خرید", sell: "فروش", rent: "اجاره/رهن" };
const LISTING_TYPE_LABEL_EN: Record<string, string> = { buy: "for purchase", sell: "for sale", rent: "for rent" };
const LISTING_TYPE_LABEL_DE: Record<string, string> = { buy: "zum Kauf", sell: "zum Verkauf", rent: "zur Miete" };

function listingLabelFor(listingType: string, lang: PromptLang): string {
  const map = tri(lang, LISTING_TYPE_LABEL_FA, LISTING_TYPE_LABEL_EN, LISTING_TYPE_LABEL_DE);
  return map[listingType] || listingType;
}

/**
 * Curated, Iran-market real-estate hashtag pool — Instagram's algorithm
 * favors a mix of broad + city-specific tags over generic marketing ones,
 * which is why this isn't just reusing the generic content prompt's
 * "give me 5 relevant hashtags" instruction.
 */
const BASE_HASHTAGS_FA = ["#املاک", "#خرید_و_فروش_ملک", "#رهن_و_اجاره", "#مشاور_املاک"];

type InstagramProperty = { title: string; listingType: string; propertyType: string; price: bigint; currency: string; address: string; city: string | null; bedrooms: number | null; areaSqm: number | null };

function buildFa(property: InstagramProperty) {
  const priceFa = formatListingPrice(property.price, property.currency, "fa");
  const listingLabel = listingLabelFor(property.listingType, "fa");
  const details = describeDetails(property, "fa");

  const system = "تو کپی‌رایتر حرفه‌ای آژانس املاک هستی که پست اینستاگرام برای معرفی ملک می‌نویسی. لحن باید حرفه‌ای، مطمئن و اعتمادساز باشد — نه تبلیغاتی و اغراق‌آمیز. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const user = `این مشخصات ملک را به یک کپشن اینستاگرام حرفه‌ای برای بازار ایران تبدیل کن:
عنوان: ${property.title}
نوع معامله: ${listingLabel}
نوع ملک: ${property.propertyType}
${details ? `مشخصات: ${details}\n` : ""}آدرس: ${property.address}${property.city ? `، ${property.city}` : ""}
قیمت: ${priceFa}

قوانین:
- کپشن باید مطمئن و حرفه‌ای باشد، نه اغراق‌آمیز یا شعارگونه.
- قیمت و متراژ را دقیقاً همانطور که داده شده ذکر کن، عدد نساز.
- در پایان کپشن یک دعوت‌به‌اقدام کوتاه برای تماس/دایرکت بگذار.
- خروجی دقیقاً این فرمت JSON:
{"caption": "متن کامل کپشن با ایموجی مناسب و بدون هشتگ داخل متن", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5", "#تگ6"], "bestTime": "توضیح کوتاه از بهترین روز و ساعت انتشار"}
حتماً ${BASE_HASHTAGS_FA.join("، ")} را در میان هشتگ‌ها بگنجان و ۲ هشتگ دیگر مرتبط با شهر/نوع ملک اضافه کن.`;

  return { system, user };
}

function buildDe(property: InstagramProperty) {
  const listingLabel = listingLabelFor(property.listingType, "de");
  const details = describeDetails(property, "de");

  const system = "Du bist ein professioneller Texter einer Immobilienagentur und schreibst einen Instagram-Beitrag zu einem Objekt. Der Ton muss professionell und vertrauensbildend sein, nicht marktschreierisch. Gib AUSSCHLIESSLICH ein rohes, gültiges JSON-Objekt zurück — keine Erklärung, kein Markdown. Schreibe alle Inhalte auf Deutsch.";
  const user = `Verwandle dieses Objekt in eine professionelle Instagram-Bildunterschrift:
Titel: ${property.title}
Angebotsart: ${listingLabel}
Objektart: ${property.propertyType}
${details ? `Eckdaten: ${details}\n` : ""}Adresse: ${property.address}${property.city ? `, ${property.city}` : ""}
Preis: ${formatListingPrice(property.price, property.currency, "de")}

Regeln:
- Selbstbewusst und professionell, nicht übertrieben.
- Übernimm Preis und Fläche exakt wie angegeben, erfinde niemals Zahlen.
- Beende den Text mit einer kurzen Handlungsaufforderung (DM/Anruf).
- Die Ausgabe muss exakt diesem JSON-Format entsprechen:
{"caption": "vollständige Bildunterschrift auf Deutsch mit passenden Emojis, keine Hashtags im Fließtext", "hashtags": ["#tag1", ...6 Tags], "bestTime": "kurz: bester Tag und beste Uhrzeit zum Posten"}`;

  return { system, user };
}

function buildEn(property: InstagramProperty) {
  const listingLabel = listingLabelFor(property.listingType, "en");
  const details = describeDetails(property, "en");

  const system = "You are a professional real-estate agency copywriter writing an Instagram listing post. Tone must be professional and trust-building, not hype-y. Return ONLY a raw, valid JSON object — no explanation or markdown.";
  const user = `Turn this property into a professional Instagram caption:
Title: ${property.title}
Listing: ${listingLabel}
Type: ${property.propertyType}
${details ? `Details: ${details}\n` : ""}Address: ${property.address}${property.city ? `, ${property.city}` : ""}
Price: ${formatListingPrice(property.price, property.currency, "en")}

Rules:
- Confident and professional, not exaggerated.
- Use the price/area exactly as given, never invent numbers.
- End with a short call-to-action to DM/call.
- Output must match exactly this JSON format:
{"caption": "full caption with fitting emojis, no hashtags inline", "hashtags": ["#tag1", ...6 tags], "bestTime": "short best day/time to post"}`;

  return { system, user };
}

async function buildInstagramPost(userId: string, propertyId: string, lang: PromptLang): Promise<GeneratedSocialPost | null> {
  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.userId !== userId) return null;

    const { system, user } = tri(lang, buildFa, buildEn, buildDe)(property);

    let raw = "";
    await routedStreamChat([{ role: "user", content: user }], system, (chunk) => { raw += chunk; }, () => {});

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!parsed.caption) return null;

    return {
      caption: String(parsed.caption),
      hashtags: (Array.isArray(parsed.hashtags) ? parsed.hashtags : []).slice(0, 8),
      bestTime: String(parsed.bestTime || ""),
    };
  } catch (err) {
    console.error("real-estate social content pack error (falling back to generic):", err);
    return null;
  }
}

registerSocialContentPack({ slug: "real-estate", buildInstagramPost });

/**
 * Section 2, item 2 — Listing Copywriter agent. Deliberately reuses this
 * same file's LLM-call shape (system/user prompt pair → routedStreamChat →
 * parse) rather than new infrastructure — "multi-platform" just means a
 * different system prompt per platform, not a different pipeline. AI only
 * ever produces a draft string; publishing/posting is a separate, human
 * action elsewhere (Instagram's existing publish flow, or copy-paste for
 * Divar/website).
 */
export type ListingCopyPlatform = "instagram" | "divar" | "website";

interface ListingCopyProperty {
  title: string; listingType: string; propertyType: string; price: bigint; currency: string;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null;
}

/** The shared facts block — identical for Divar and website, only the system prompt differs. */
function listingFacts(property: ListingCopyProperty, lang: PromptLang): string {
  const details = describeDetails(property, lang);
  const price = formatListingPrice(property.price, property.currency, lang);
  const city = property.city ? tri(lang, `، ${property.city}`, `, ${property.city}`, `, ${property.city}`) : "";
  return tri(lang,
    `عنوان: ${property.title}\nنوع ملک: ${property.propertyType}\n${details ? `مشخصات: ${details}\n` : ""}آدرس: ${property.address}${city}\nقیمت: ${price}\nقیمت و متراژ را دقیقاً همان‌طور که داده شده ذکر کن، عدد نساز.`,
    `Title: ${property.title}\nType: ${property.propertyType}\n${details ? `Details: ${details}\n` : ""}Address: ${property.address}${city}\nPrice: ${price}\nUse the price/area exactly as given, never invent numbers.`,
    `Titel: ${property.title}\nObjektart: ${property.propertyType}\n${details ? `Eckdaten: ${details}\n` : ""}Adresse: ${property.address}${city}\nPreis: ${price}\nÜbernimm Preis und Fläche exakt wie angegeben, erfinde niemals Zahlen.`);
}

function buildDivarPrompt(property: ListingCopyProperty, lang: PromptLang) {
  // Divar's own listing convention: plain factual paragraphs, no emojis,
  // no hashtags, no call-to-action fluff — its audience reads it as a
  // classified ad, not a marketing post.
  const system = tri(lang,
    "تو توضیحات آگهی ملک برای یک سایت نیازمندی (به سبک دیوار) می‌نویسی — بدون ایموجی، بدون هشتگ، بدون زبان تبلیغاتی. فقط و فقط متن توضیحات را برگردان، هیچ چیز دیگری.",
    "You write plain, factual property-listing descriptions for a classifieds site (Divar-style) — no emojis, no hashtags, no marketing language. Return ONLY the description text, nothing else.",
    "Du schreibst sachliche Objektbeschreibungen für ein Kleinanzeigenportal (im Stil von Divar) — keine Emojis, keine Hashtags, keine Werbesprache. Gib AUSSCHLIESSLICH den Beschreibungstext auf Deutsch zurück, sonst nichts.");
  const user = tri(lang,
    `توضیحات آگهی نیازمندی برای این ملک بنویس:\n${listingFacts(property, "fa")}`,
    `Write a factual classifieds description for:\n${listingFacts(property, "en")}`,
    `Schreibe eine sachliche Kleinanzeigen-Beschreibung für:\n${listingFacts(property, "de")}`);
  return { system, user };
}

function buildWebsitePrompt(property: ListingCopyProperty, lang: PromptLang) {
  const system = tri(lang,
    "تو توضیحات سئو-پسند آگهی ملک برای وبسایت خود یک آژانس املاک می‌نویسی — ۲ تا ۳ پاراگراف کوتاه، لحن حرفه‌ای، استفاده طبیعی (نه انباشته) از کلمات کلیدی منطقه/نوع ملک. فقط و فقط متن توضیحات را برگردان.",
    "You write SEO-friendly property listing descriptions for a real-estate agency's own website — 2-3 short paragraphs, professional tone, natural (not stuffed) use of location/property-type keywords. Return ONLY the description text.",
    "Du schreibst SEO-freundliche Objektbeschreibungen für die eigene Website einer Immobilienagentur — 2 bis 3 kurze Absätze, professioneller Ton, natürliche (nicht überladene) Verwendung von Lage- und Objektart-Keywords. Gib AUSSCHLIESSLICH den Beschreibungstext auf Deutsch zurück.");
  const user = tri(lang,
    `توضیحات وبسایتی این ملک را بنویس:\n${listingFacts(property, "fa")}`,
    `Write a website listing description for:\n${listingFacts(property, "en")}`,
    `Schreibe eine Website-Objektbeschreibung für:\n${listingFacts(property, "de")}`);
  return { system, user };
}

export interface ListingCopyResult {
  content: string;
  hashtags?: string[];
}

export async function generateListingCopy(userId: string, propertyId: string, lang: PromptLang, platform: ListingCopyPlatform): Promise<ListingCopyResult | null> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.userId !== userId) return null;

  if (platform === "instagram") {
    const post = await buildInstagramPost(userId, propertyId, lang);
    return post ? { content: post.caption, hashtags: post.hashtags } : null;
  }

  const { system, user } = platform === "divar" ? buildDivarPrompt(property, lang) : buildWebsitePrompt(property, lang);
  let content = "";
  await routedStreamChat([{ role: "user", content: user }], system, (chunk) => { content += chunk; }, () => {});
  content = content.trim();
  return content ? { content } : null;
}
