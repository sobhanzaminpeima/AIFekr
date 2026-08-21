import { registerContentIdeas } from "../registry";

// Proven, well-known real-estate content formats — not live trend data (this
// registry has no such source). See registry.ts's ContentIdea doc comment.
registerContentIdeas("real-estate", [
  { title: "تور مجازی ملک", format: "ویدیوی کوتاه واک-تراو از فضای داخلی ملک", why: "بازدید مجازی نرخ تماس لید را نسبت به عکس ساده بالا می‌برد" },
  { title: "قبل/بعد بازسازی", format: "مقایسه تصویری یا اسلایدشو از وضعیت قبل و بعد بازسازی ملک", why: "ارزش افزوده کار شما را ملموس نشان می‌دهد" },
  { title: "یک روز با مشاور املاک", format: "پشت‌صحنه بازدیدها و مذاکرات یک روز کاری", why: "اعتماد و صمیمیت نسبت به برند شخصی مشاور می‌سازد" },
  { title: "راهنمای محله", format: "معرفی امکانات، مترو، مدارس و مراکز خرید نزدیک ملک", why: "خریداران/مستأجران قبل از تماس دنبال همین اطلاعات‌اند" },
  { title: "سوالات متداول خریداران", format: "استوری Q&A درباره وام، رهن، مراحل قرارداد", why: "مخاطبانی که هنوز آماده تماس نیستند را درگیر نگه می‌دارد" },
]);
