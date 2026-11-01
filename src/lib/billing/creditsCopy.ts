import type { Lang } from "@/lib/i18n/server";
import type { Four } from "@/lib/crm/crmCopy.extract";
import { TOOL_FEATURES, toolFeatureLabel } from "@/lib/utils/credits";

/**
 * The credit wallet page for the new design: the classic page's wording and
 * label tables (components/billing/CreditsWorkspace.tsx), verbatim, keyed by
 * English ({name} is filled in by the page). creditsCopy.test.ts fails if this drifts.
 */
export const CREDITS_STRINGS: [string, Four][] = [
  ["Toman", ["تومان", "Toman", "Toman", "Toman"]],
  ["Rate unavailable", ["نرخ در دسترس نیست", "Rate unavailable", "Kurs nicht verfügbar", "Kur bulunamadı"]],
  ["Credit purchase successful", ["خرید کردیت با موفقیت انجام شد", "Credit purchase successful", "Guthabenkauf erfolgreich", "Kredi satın alma başarılı"]],
  ["Payment failed", ["پرداخت ناموفق بود", "Payment failed", "Zahlung fehlgeschlagen", "Ödeme başarısız"]],
  ["Failed to start payment", ["خطا در شروع پرداخت", "Failed to start payment", "Zahlung konnte nicht gestartet werden", "Ödeme başlatılamadı"]],
  ["Credit Wallet", ["کیف پول کردیت", "Credit Wallet", "Guthaben-Wallet", "Kredi Cüzdanı"]],
  ["Your credits are used across all AiFekr content-generation tools.", ["کردیت شما برای همه ابزارهای تولید محتوای AiFekr استفاده می‌شود.", "Your credits are used across all AiFekr content-generation tools.", "Ihr Guthaben wird für alle AiFekr-Content-Tools verwendet.", "Krediniz tüm AiFekr içerik oluşturma araçlarında kullanılır."]],
  ["Your FIT membership is inactive. Buying credits does not renew membership.", ["عضویت FIT شما فعال نیست. خرید اعتبار، عضویت را تمدید نمی‌کند.", "Your FIT membership is inactive. Buying credits does not renew membership.", "Ihre FIT-Mitgliedschaft ist inaktiv. Ein Guthabenkauf verlängert sie nicht.", "FIT üyeliğiniz aktif değil. Kredi satın almak üyeliği yenilemez."]],
  ["Renew FIT membership", ["تمدید عضویت FIT", "Renew FIT membership", "FIT-Mitgliedschaft verlängern", "FIT üyeliğini yenile"]],
  ["Available credits today", ["کردیت قابل‌استفاده امروز", "Available credits today", "Heute verfügbares Guthaben", "Bugün mevcut kredi"]],
  ["AI Credits", ["کردیت هوش مصنوعی", "AI Credits", "KI-Guthaben", "Yapay Zeka Kredisi"]],
  ["Media Credits", ["کردیت رسانه", "Media Credits", "Medien-Guthaben", "Medya Kredisi"]],
  ["Voice Minutes", ["دقایق صدا", "Voice Minutes", "Sprachminuten", "Ses Dakikası"]],
  ["Usage — last 30 days", ["مصرف ۳۰ روز اخیر", "Usage — last 30 days", "Nutzung — letzte 30 Tage", "Son 30 gün kullanım"]],
  ["credits", ["کردیت", "credits", "Guthaben", "kredi"]],
  ["Buy Credits", ["خرید کردیت", "Buy Credits", "Guthaben kaufen", "Kredi Satın Al"]],
  ["No purchase tiers are available right now.", ["در حال حاضر تعرفه‌ای برای خرید موجود نیست.", "No purchase tiers are available right now.", "Derzeit sind keine Kaufstufen verfügbar.", "Şu anda satın alma paketi mevcut değil."]],
  ["usable credits", ["کردیت قابل استفاده", "usable credits", "nutzbare Guthaben", "kullanılabilir kredi"]],
  ["{formatNumber} Toman/credit", ["هر کردیت {formatNumber} تومان", "{formatNumber} Toman/credit", "{formatNumber} Toman/Guthaben", "Kredi başına {formatNumber} Toman"]],
  ["Buy", ["خرید", "Buy", "Kaufen", "Satın Al"]],
  ["Credit purchases", ["خریدهای کردیت", "Credit purchases", "Guthabenkäufe", "Kredi satın alımları"]],
  ["No transactions yet.", ["هنوز تراکنشی ثبت نشده است.", "No transactions yet.", "Noch keine Transaktionen.", "Henüz işlem yok."]],
  ["Credit usage", ["مصرف کردیت", "Credit usage", "Guthabenverbrauch", "Kredi kullanımı"]],
  ["No credits used yet.", ["هنوز کردیتی مصرف نشده است.", "No credits used yet.", "Noch kein Guthaben verbraucht.", "Henüz kredi kullanılmadı."]],
];
export const CREDITS_LABELS: Record<string, Record<string, Four>> = {
  TYPE_LABEL: {
    "chat": ["چت", "Chat", "Chat", "Chat"],
    "image": ["تصویر", "Image", "Bild", "Image"],
    "video": ["ویدیو", "Video", "Video", "Video"],
    "music": ["موزیک", "Music", "Musik", "Music"],
    "voice": ["صدا", "Voice", "Sprache", "Voice"],
    "tool": ["ابزار", "Tool", "Werkzeug", "Tool"],
  },
  PLAN_LABEL: {
    "FREE": ["رایگان", "Free", "Kostenlos", "Free"],
    "BASIC": ["پایه", "Basic", "Basis", "Basic"],
    "PRO": ["حرفه‌ای", "Pro", "Pro", "Pro"],
    "TEAM": ["تیمی", "Team", "Team", "Team"],
  },
  BADGE_LABEL: {
    "best_value": ["پرفروش‌ترین", "Best value", "Bestseller", "Best value"],
    "most_discount": ["بیشترین تخفیف", "Most discount", "Größter Rabatt", "Most discount"],
  },
  TX_TYPE_LABEL: {
    "purchase": ["خرید کردیت", "Credit purchase", "Guthabenkauf", "Credit purchase"],
  },
  USAGE_TYPE_LABEL: {
    "chat": ["چت", "Chat", "Chat", "Chat"],
    "image": ["تولید تصویر", "Image generation", "Bildgenerierung", "Image generation"],
    "video": ["تولید ویدیو", "Video generation", "Videogenerierung", "Video generation"],
    "music": ["تولید موزیک", "Music generation", "Musikgenerierung", "Music generation"],
    "seo": ["سئو", "SEO", "SEO", "SEO"],
    "tool": ["ابزار هوش مصنوعی", "AI tool", "KI-Tool", "AI tool"],
    "voice": ["دستیار صوتی", "Voice agent", "Sprachassistent", "Voice agent"],
    "social": ["شبکه‌های اجتماعی", "Social", "Social Media", "Social"],
  },
};

const COLUMN: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
export function creditsCopy(lang: Lang) {
  const column = COLUMN[lang] ?? 1;
  return {
    strings: Object.fromEntries(CREDITS_STRINGS.map(([key, r]) => [key, r[column]])) as Record<string, string>,
    labels: Object.fromEntries(Object.entries(CREDITS_LABELS).map(([t, e]) => [t, Object.fromEntries(Object.entries(e).map(([k, r]) => [k, r[column]]))])) as Record<string, Record<string, string>>,
    /** The AI tools' names in the usage history (UsageLog.feature), as the classic page shows them. */
    tools: Object.fromEntries(Object.keys(TOOL_FEATURES).map((f) => [f, toolFeatureLabel(f, lang)])) as Record<string, string>,
  };
}
