import type { Lang } from "@/lib/i18n/server";

/**
 * The chat's options and starter prompts, shared by the classic chat
 * (components/chat/ChatInterface) and the new design (/api/app/shell). Icons
 * stay in each design.
 */
export type MediaType = "chat" | "image" | "video" | "music";

export const EXPERT_MODES_DATA = [
  { id: "default",   labelFa: "دستیار هوشمند",     labelEn: "Smart Assistant", labelDe: "Intelligenter Assistent",     color: "#ea580c" },
  { id: "business",  labelFa: "دکتر کسب‌وکار",     labelEn: "Business Doctor", labelDe: "Geschäftsberater",    color: "#3b82f6" },
  { id: "marketing", labelFa: "بازاریابی",          labelEn: "Marketing",       labelDe: "Marketing",   color: "#10b981" },
  { id: "financial", labelFa: "مالی و سرمایه",      labelEn: "Financial",       labelDe: "Finanzen",   color: "#f59e0b" },
  { id: "sales",     labelFa: "فروش",               labelEn: "Sales",           labelDe: "Vertrieb", color: "#8b5cf6" },
  { id: "startup",   labelFa: "استارتاپ",           labelEn: "Startup",         labelDe: "Startup",       color: "#ef4444" },
  { id: "legal",     labelFa: "حقوقی",              labelEn: "Legal",           labelDe: "Recht",        color: "#06b6d4" },
  { id: "hr",        labelFa: "منابع انسانی",       labelEn: "HR & People",     labelDe: "HR & Personal",        color: "#d97706" },
];

export const MEDIA_TABS_DATA: { id: MediaType; fa: string; en: string; de: string }[] = [
  { id: "chat", fa: "همه",   en: "All",   de: "Alle" },
  { id: "image",     fa: "عکس",   en: "Image", de: "Bild" },
  { id: "video",         fa: "ویدیو", en: "Video", de: "Video" },
  { id: "music",         fa: "موزیک", en: "Music", de: "Musik" },
];

export const RATIOS = ["1:1", "16:9", "9:16", "4:3"];
export const RATIO_LABEL: Record<string, Record<Lang, string>> = {
  "1:1":  { fa: "مربع", en: "Square", de: "Quadrat", tr: "Square" },
  "16:9": { fa: "افقی", en: "Landscape", de: "Querformat", tr: "Landscape" },
  "9:16": { fa: "عمودی", en: "Portrait", de: "Hochformat", tr: "Portrait" },
  "4:3":  { fa: "کلاسیک", en: "Classic", de: "Klassisch", tr: "Classic" },
};
export const IMAGE_STYLES = ["realistic", "anime", "painting", "minimal", "fantasy", "3d"];
export const IMAGE_STYLE_LABEL: Record<string, Record<Lang, string>> = {
  realistic: { fa: "واقعی", en: "Realistic", de: "Realistisch", tr: "Realistic" },
  anime: { fa: "انیمه", en: "Anime", de: "Anime", tr: "Anime" },
  painting: { fa: "نقاشی", en: "Painting", de: "Gemälde", tr: "Painting" },
  minimal: { fa: "مینیمال", en: "Minimal", de: "Minimalistisch", tr: "Minimal" },
  fantasy: { fa: "فانتزی", en: "Fantasy", de: "Fantasy", tr: "Fantasy" },
  "3d": { fa: "سه‌بعدی", en: "3D", de: "3D", tr: "3D" },
};
export const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
export const VIDEO_STYLES = [
  { value: "واقعی", fa: "واقعی", en: "Realistic", de: "Realistisch" },
  { value: "انیمیشن", fa: "انیمیشن", en: "Animation", de: "Animation" },
  { value: "سینمایی", fa: "سینمایی", en: "Cinematic", de: "Filmisch" },
  { value: "کارتونی", fa: "کارتونی", en: "Cartoon", de: "Cartoon" },
];
export const VIDEO_DURATIONS = [{ value: 5, credits: 20 }, { value: 10, credits: 35 }, { value: 30, credits: 80 }];
export const MUSIC_GENRES = ["پاپ", "کلاسیک", "الکترونیک", "سنتی ایرانی", "آرامش‌بخش", "راک", "جاز", "هیپ‌هاپ"];
export const MUSIC_DURATIONS = [{ value: 30, credits: 10 }, { value: 60, credits: 18 }, { value: 120, credits: 30 }];
export const IMAGE_CATEGORIES = [
  { id: "all", fa: "همه", en: "All", de: "Alle" },
  { id: "portrait", fa: "پرتره", en: "Portrait", de: "Porträt" },
  { id: "product", fa: "محصول", en: "Product", de: "Produkt" },
  { id: "landscape", fa: "منظره و طبیعت", en: "Landscape", de: "Landschaft" },
  { id: "art", fa: "هنری و نقاشی", en: "Art", de: "Kunst" },
  { id: "corporate", fa: "کسب‌وکار", en: "Corporate", de: "Unternehmen" },
  { id: "fantasy", fa: "فانتزی و سینمایی", en: "Fantasy", de: "Fantasie" },
  { id: "1980s", fa: "دهه ۸۰ میلادی", en: "1980s", de: "1980er" },
];
export const REFERENCE_REQUIRED_CATEGORIES = new Set(["1980s"]);

export const STARTER_PROMPTS_FA = [
  "یک ایمیل رسمی برای من بنویس",
  "این متن رو خلاصه کن",
  "برای سفرم به یک شهر جدید برنامه بریز",
  "چطور برای استارتاپم یک مدل کسب‌وکار بسازم؟",
];
export const STARTER_PROMPTS_EN = [
  "Write a formal email for me",
  "Summarize this text",
  "Plan a trip to a new city",
  "How do I build a business model for my startup?",
];
export const STARTER_PROMPTS_DE = [
  "Schreiben Sie ein formelles E-Mail für mich",
  "Fassen Sie diesen Text zusammen",
  "Planen Sie eine Reise in eine neue Stadt",
  "Wie erstelle ich ein Geschäftsmodell für mein Startup?",
];

/** Starters for real-estate accounts: fa, en, de, tr. */
export const STARTER_PROMPTS_REAL_ESTATE: [string[], string[], string[], string[]] = [
  ["برای ملکم یک آگهی جذاب برای دیوار و اینستاگرام بنویس", "یک پیام پیگیری مودبانه برای مشتری‌ای که بازدید رفته بنویس", "قیمت مناسب آپارتمان ۱۲۰ متری را چطور تعیین کنم؟", "برنامهٔ هفتگی پیگیری لیدهایم را بچین"],
  ["Write an appealing listing for my property", "Write a polite follow-up to a client after a viewing", "How should I price a 120 m² apartment?", "Plan my weekly lead follow-ups"],
  ["Schreibe ein ansprechendes Exposé für meine Immobilie", "Schreibe eine höfliche Nachricht nach einer Besichtigung", "Wie bepreise ich eine 120-m²-Wohnung?", "Plane meine wöchentlichen Lead-Nachfassungen"],
  ["Mülküm için çekici bir ilan yaz", "Görüntülemeden sonra müşteriye kibar bir takip mesajı yaz", "120 m² bir daireyi nasıl fiyatlandırmalıyım?", "Haftalık müşteri takip planımı hazırla"],
];

/** Where an answer's figures came from (capability key -> fa, en, de). */
export const DATA_SOURCE_NAMES: Record<string, [string, string, string]> = {
  crm: ["CRM شما", "your CRM", "Ihrem CRM"],
  accounting: ["حسابداری شما", "your accounting", "Ihrer Buchhaltung"],
  social: ["شبکه‌های اجتماعی شما", "your social media", "Ihren Social-Media-Daten"],
  ceo: ["داده‌های کل کسب‌وکار شما", "your whole-business data", "Ihren gesamten Unternehmensdaten"],
};
