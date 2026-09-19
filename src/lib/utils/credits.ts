/// Credits granted to BOTH the referrer and the referred user once the
/// referred user completes their first paid purchase (see
/// src/app/api/payment/verify/route.ts). ~1/3 of the free-signup bonus —
/// meaningful without letting a referral loop rival an actual purchase.
export const REFERRAL_BONUS_CREDITS = 100;

export const CREDIT_COSTS = {
  chat: 1,
  image_standard: 5,
  image_hd: 10,
  video_5s: 20,
  video_10s: 35,
  video_30s: 80,
  music_30s: 10,
  music_60s: 18,
  music_120s: 30,
  tool: 2,
} as const;

export const PLAN_LIMITS = {
  FREE: {
    dailyChats: 20,
    monthlyImages: 90,
    monthlyVideos: 0,
    monthlyMusics: 0,
    weeklyVideos: 0,
    dailyImages: 3,
    initialCredits: 100,
  },
  // ── New Iran tiers ──────────────────────────────────────────
  ECHO: {
    dailyChats: -1,       // 50/3h enforced in chat route
    monthlyImages: 450,   // 15/day
    monthlyVideos: 0,
    monthlyMusics: 0,
    weeklyVideos: 0,
    dailyImages: 15,
    initialCredits: 300,
  },
  PLUS: {
    dailyChats: -1,       // 100/3h
    monthlyImages: -1,
    monthlyVideos: 0,
    monthlyMusics: -1,
    weeklyVideos: 0,
    dailyImages: -1,
    initialCredits: 800,
  },
  PRO: {
    dailyChats: -1,       // 150/3h
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    weeklyVideos: 80,     // 20/week
    dailyImages: -1,
    initialCredits: 2000,
  },
  ALPHA: {
    dailyChats: -1,       // 750/3h
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    weeklyVideos: 400,    // 100/week
    dailyImages: -1,
    initialCredits: 8000,
  },
  // ── International (USD) tiers ────────────────────────────────
  STARTER_USD: {
    dailyChats: -1,
    monthlyImages: 450,
    monthlyVideos: 0,
    monthlyMusics: 0,
    weeklyVideos: 0,
    dailyImages: 15,
    initialCredits: 300,
  },
  PLUS_USD: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: 0,
    monthlyMusics: -1,
    weeklyVideos: 0,
    dailyImages: -1,
    initialCredits: 800,
  },
  PRO_USD: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    weeklyVideos: 80,
    dailyImages: -1,
    initialCredits: 2000,
  },
  ULTRA_USD: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    weeklyVideos: 400,
    dailyImages: -1,
    initialCredits: 8000,
  },
  // ── Legacy plan codes (kept for existing users) ──────────────
  BASIC: {
    dailyChats: -1,
    monthlyImages: 50,
    monthlyVideos: 5,
    monthlyMusics: 10,
    weeklyVideos: 0,
    dailyImages: -1,
    initialCredits: 500,
  },
  TEAM: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    weeklyVideos: 400,
    dailyImages: -1,
    initialCredits: 5000,
  },
} as const;

// Toman prices (for display and ZarinPal × 10 = rial)
export const PLAN_PRICES_TOMAN: Record<string, number> = {
  FREE: 0,
  ECHO: 149000,
  PLUS: 449000,
  PRO: 1290000,
  ALPHA: 3990000,
  // Legacy
  BASIC: 150000,
  TEAM: 800000,
};

// USD prices (cents)
export const PLAN_PRICES_USD: Record<string, number> = {
  FREE: 0,
  STARTER_USD: 900,
  PLUS_USD: 1900,
  PRO_USD: 4900,
  ULTRA_USD: 9900,
};

// Rial prices for DB/ZarinPal (toman × 10)
export const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  ECHO: 1490000,
  PLUS: 4490000,
  PRO: 12900000,
  ALPHA: 39900000,
  BASIC: 1500000,
  TEAM: 8000000,
};

export const PLAN_NAMES_FA: Record<string, string> = {
  FREE: "رایگان",
  ECHO: "اکو",
  PLUS: "پلاس",
  PRO: "پرو",
  ALPHA: "الفا",
  STARTER_USD: "Starter",
  PLUS_USD: "Plus",
  PRO_USD: "Pro",
  ULTRA_USD: "Ultra",
  BASIC: "پایه",
  TEAM: "تیمی",
};

/**
 * Text-LLM "tool" features that are charged per use. Each gets its own
 * admin-editable price in Credit Rules (key `tool_<feature>`), defaulting to
 * the general `tool` cost, so an expensive section (say the website designer)
 * can be priced apart from a cheap one without a deploy.
 */
export const TOOL_FEATURES: Record<string, string> = {
  "accounting.ask": "حسابداری — دستیار مالی (پرسش)",
  "accounting.audit-copilot": "حسابداری — کمک‌ممیز",
  "accounting.cash-flow-narrative": "حسابداری — روایت جریان نقدی",
  "accounting.owner-statement-assist": "حسابداری — کمک صورت‌حساب مالک",
  "accounting.propose": "حسابداری — پیشنهاد سند/دسته‌بندی",
  "business-doctor": "دکتر کسب‌وکار",
  "ceo.boardroom": "CEO — هیئت‌مدیره",
  "ceo.question": "CEO — پرسش",
  "ceo.auto-run": "CEO — گزارش خودکار روزانه",
  "ceo.orchestrator-run": "CEO — تحلیل ارکستراتور",
  "ceo.followup-drafts": "CEO — پیش‌نویس پیگیری",
  "sales.agent": "فروش — عامل فروش",
  "sales.followup-drafts": "فروش — پیش‌نویس پیگیری",
  "meeting": "جلسه هوشمند",
  "seo.analyze": "سئو — تحلیل",
  "seo.suggest": "سئو — پیشنهاد",
  "seo.pipeline": "سئو — عامل چندمرحله‌ای",
  "seo.audit-fix": "سئو — رفع مشکلات ممیزی",
  "social.generate": "شبکه اجتماعی — تولید محتوا",
  "social.competitors": "شبکه اجتماعی — تحلیل رقبا",
  "social.ig-report": "اینستاگرام — گزارش",
  "social.ig-image": "اینستاگرام — تحلیل تصویر",
  "startup.generate": "استارتاپ — تولید",
  "website-designer": "طراح وب‌سایت",
  "image.translate": "ترجمه تصویر",
  "crm.agent-run": "CRM — اجرای عامل تحلیل",
  "crm.lead-matcher": "CRM — تطبیق سرنخ",
  "crm.listing-copy": "CRM — متن آگهی ملک",
  "crm.pricing-advice": "CRM — پیشنهاد قیمت ملک",
  "crm.agency-report": "CRM — گزارش آژانس",
};

export const toolCostKey = (feature: string) => "tool_" + feature.replace(/[.-]/g, "_");

/** Per-feature defaults: every tool starts at the general `tool` price. */
export const TOOL_COST_DEFAULTS: Record<string, number> = Object.fromEntries(
  Object.keys(TOOL_FEATURES).map((f) => [toolCostKey(f), CREDIT_COSTS.tool]),
);

export const TOOL_COST_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_FEATURES).map(([f, label]) => [toolCostKey(f), label]),
);
