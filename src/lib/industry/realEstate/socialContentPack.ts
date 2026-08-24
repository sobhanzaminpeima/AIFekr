import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { registerSocialContentPack, type GeneratedSocialPost } from "../registry";

const LISTING_TYPE_LABEL_FA: Record<string, string> = { buy: "خرید", sell: "فروش", rent: "اجاره/رهن" };
const LISTING_TYPE_LABEL_EN: Record<string, string> = { buy: "for purchase", sell: "for sale", rent: "for rent" };

/**
 * Curated, Iran-market real-estate hashtag pool — Instagram's algorithm
 * favors a mix of broad + city-specific tags over generic marketing ones,
 * which is why this isn't just reusing the generic content prompt's
 * "give me 5 relevant hashtags" instruction.
 */
const BASE_HASHTAGS_FA = ["#املاک", "#خرید_و_فروش_ملک", "#رهن_و_اجاره", "#مشاور_املاک"];

function buildFa(property: { title: string; listingType: string; propertyType: string; price: bigint; address: string; city: string | null; bedrooms: number | null; areaSqm: number | null }) {
  const priceFa = Number(property.price).toLocaleString("fa-IR");
  const listingLabel = LISTING_TYPE_LABEL_FA[property.listingType] || property.listingType;
  const details = [
    property.areaSqm ? `متراژ ${property.areaSqm} متر` : null,
    property.bedrooms ? `${property.bedrooms} خوابه` : null,
  ].filter(Boolean).join("، ");

  const system = "تو کپی‌رایتر حرفه‌ای آژانس املاک هستی که پست اینستاگرام برای معرفی ملک می‌نویسی. لحن باید حرفه‌ای، مطمئن و اعتمادساز باشد — نه تبلیغاتی و اغراق‌آمیز. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const user = `این مشخصات ملک را به یک کپشن اینستاگرام حرفه‌ای برای بازار ایران تبدیل کن:
عنوان: ${property.title}
نوع معامله: ${listingLabel}
نوع ملک: ${property.propertyType}
${details ? `مشخصات: ${details}\n` : ""}آدرس: ${property.address}${property.city ? `، ${property.city}` : ""}
قیمت: ${priceFa} تومان

قوانین:
- کپشن باید مطمئن و حرفه‌ای باشد، نه اغراق‌آمیز یا شعارگونه.
- قیمت و متراژ را دقیقاً همانطور که داده شده ذکر کن، عدد نساز.
- در پایان کپشن یک دعوت‌به‌اقدام کوتاه برای تماس/دایرکت بگذار.
- خروجی دقیقاً این فرمت JSON:
{"caption": "متن کامل کپشن با ایموجی مناسب و بدون هشتگ داخل متن", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5", "#تگ6"], "bestTime": "توضیح کوتاه از بهترین روز و ساعت انتشار"}
حتماً ${BASE_HASHTAGS_FA.join("، ")} را در میان هشتگ‌ها بگنجان و ۲ هشتگ دیگر مرتبط با شهر/نوع ملک اضافه کن.`;

  return { system, user };
}

function buildEn(property: { title: string; listingType: string; propertyType: string; price: bigint; address: string; city: string | null; bedrooms: number | null; areaSqm: number | null }) {
  const listingLabel = LISTING_TYPE_LABEL_EN[property.listingType] || property.listingType;
  const details = [
    property.areaSqm ? `${property.areaSqm} sqm` : null,
    property.bedrooms ? `${property.bedrooms} bedrooms` : null,
  ].filter(Boolean).join(", ");

  const system = "You are a professional real-estate agency copywriter writing an Instagram listing post. Tone must be professional and trust-building, not hype-y. Return ONLY a raw, valid JSON object — no explanation or markdown.";
  const user = `Turn this property into a professional Instagram caption:
Title: ${property.title}
Listing: ${listingLabel}
Type: ${property.propertyType}
${details ? `Details: ${details}\n` : ""}Address: ${property.address}${property.city ? `, ${property.city}` : ""}
Price: ${Number(property.price).toLocaleString("en-US")} Toman

Rules:
- Confident and professional, not exaggerated.
- Use the price/area exactly as given, never invent numbers.
- End with a short call-to-action to DM/call.
- Output must match exactly this JSON format:
{"caption": "full caption with fitting emojis, no hashtags inline", "hashtags": ["#tag1", ...6 tags], "bestTime": "short best day/time to post"}`;

  return { system, user };
}

async function buildInstagramPost(userId: string, propertyId: string, lang: "fa" | "en"): Promise<GeneratedSocialPost | null> {
  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.userId !== userId) return null;

    const { system, user } = lang === "en" ? buildEn(property) : buildFa(property);

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
  title: string; listingType: string; propertyType: string; price: bigint;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null;
}

function buildDivarPrompt(property: ListingCopyProperty, lang: "fa" | "en") {
  const priceFa = Number(property.price).toLocaleString("fa-IR");
  const details = [
    property.areaSqm ? `${property.areaSqm} متر` : null,
    property.bedrooms ? `${property.bedrooms} خوابه` : null,
    property.bathrooms ? `${property.bathrooms} سرویس` : null,
  ].filter(Boolean).join("، ");
  // Divar's own listing convention: plain factual paragraphs, no emojis,
  // no hashtags, no call-to-action fluff — its audience reads it as a
  // classified ad, not a marketing post.
  const system = lang === "en"
    ? "You write plain, factual property-listing descriptions for a classifieds site (Divar-style) — no emojis, no hashtags, no marketing language. Return ONLY the description text, nothing else."
    : "تو توضیحات آگهی ملک برای یک سایت نیازمندی (به سبک دیوار) می‌نویسی — بدون ایموجی، بدون هشتگ، بدون زبان تبلیغاتی. فقط و فقط متن توضیحات را برگردان، هیچ چیز دیگری.";
  const user = lang === "en"
    ? `Write a factual classifieds description for:\nTitle: ${property.title}\nType: ${property.propertyType}\n${details ? `Details: ${details}\n` : ""}Address: ${property.address}${property.city ? `, ${property.city}` : ""}\nPrice: ${Number(property.price).toLocaleString("en-US")} Toman\nUse the price/area exactly as given, never invent numbers.`
    : `توضیحات آگهی نیازمندی برای این ملک بنویس:\nعنوان: ${property.title}\nنوع ملک: ${property.propertyType}\n${details ? `مشخصات: ${details}\n` : ""}آدرس: ${property.address}${property.city ? `، ${property.city}` : ""}\nقیمت: ${priceFa} تومان\nقیمت و متراژ را دقیقاً همان‌طور که داده شده ذکر کن، عدد نساز.`;
  return { system, user };
}

function buildWebsitePrompt(property: ListingCopyProperty, lang: "fa" | "en") {
  const priceFa = Number(property.price).toLocaleString("fa-IR");
  const details = [
    property.areaSqm ? `${property.areaSqm} متر` : null,
    property.bedrooms ? `${property.bedrooms} خوابه` : null,
    property.bathrooms ? `${property.bathrooms} سرویس` : null,
  ].filter(Boolean).join("، ");
  const system = lang === "en"
    ? "You write SEO-friendly property listing descriptions for a real-estate agency's own website — 2-3 short paragraphs, professional tone, natural (not stuffed) use of location/property-type keywords. Return ONLY the description text."
    : "تو توضیحات سئو-پسند آگهی ملک برای وبسایت خود یک آژانس املاک می‌نویسی — ۲ تا ۳ پاراگراف کوتاه، لحن حرفه‌ای، استفاده طبیعی (نه انباشته) از کلمات کلیدی منطقه/نوع ملک. فقط و فقط متن توضیحات را برگردان.";
  const user = lang === "en"
    ? `Write a website listing description for:\nTitle: ${property.title}\nType: ${property.propertyType}\n${details ? `Details: ${details}\n` : ""}Address: ${property.address}${property.city ? `, ${property.city}` : ""}\nPrice: ${Number(property.price).toLocaleString("en-US")} Toman\nUse the price/area exactly as given, never invent numbers.`
    : `توضیحات وبسایتی این ملک را بنویس:\nعنوان: ${property.title}\nنوع ملک: ${property.propertyType}\n${details ? `مشخصات: ${details}\n` : ""}آدرس: ${property.address}${property.city ? `، ${property.city}` : ""}\nقیمت: ${priceFa} تومان\nقیمت و متراژ را دقیقاً همان‌طور که داده شده ذکر کن، عدد نساز.`;
  return { system, user };
}

export interface ListingCopyResult {
  content: string;
  hashtags?: string[];
}

export async function generateListingCopy(userId: string, propertyId: string, lang: "fa" | "en", platform: ListingCopyPlatform): Promise<ListingCopyResult | null> {
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
