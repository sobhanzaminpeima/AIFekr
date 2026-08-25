import { registerContentIdeas } from "../registry";

// Proven, well-known real-estate content formats — not live trend data (this
// registry has no such source). See registry.ts's ContentIdea doc comment.
registerContentIdeas("real-estate", [
  {
    title: { fa: "تور مجازی ملک", en: "Virtual property tour", de: "Virtuelle Immobilienbesichtigung" },
    format: { fa: "ویدیوی کوتاه واک-تراو از فضای داخلی ملک", en: "A short walk-through video of the property's interior", de: "Ein kurzes Walk-Through-Video des Immobilieninnenraums" },
    why: { fa: "بازدید مجازی نرخ تماس لید را نسبت به عکس ساده بالا می‌برد", en: "A virtual tour raises the lead-contact rate compared to plain photos", de: "Eine virtuelle Tour erhöht die Kontaktrate im Vergleich zu einfachen Fotos" },
  },
  {
    title: { fa: "قبل/بعد بازسازی", en: "Before/after renovation", de: "Vorher/nachher Renovierung" },
    format: { fa: "مقایسه تصویری یا اسلایدشو از وضعیت قبل و بعد بازسازی ملک", en: "A visual comparison or slideshow of the property before and after renovation", de: "Ein Bildvergleich oder eine Diashow der Immobilie vor und nach der Renovierung" },
    why: { fa: "ارزش افزوده کار شما را ملموس نشان می‌دهد", en: "Makes the added value of your work tangible", de: "Macht den Mehrwert deiner Arbeit greifbar" },
  },
  {
    title: { fa: "یک روز با مشاور املاک", en: "A day with a real-estate agent", de: "Ein Tag mit einem Immobilienmakler" },
    format: { fa: "پشت‌صحنه بازدیدها و مذاکرات یک روز کاری", en: "Behind-the-scenes footage of a workday's viewings and negotiations", de: "Behind-the-Scenes-Aufnahmen von Besichtigungen und Verhandlungen an einem Arbeitstag" },
    why: { fa: "اعتماد و صمیمیت نسبت به برند شخصی مشاور می‌سازد", en: "Builds trust and closeness around the agent's personal brand", de: "Schafft Vertrauen und Nähe zur persönlichen Marke des Maklers" },
  },
  {
    title: { fa: "راهنمای محله", en: "Neighborhood guide", de: "Nachbarschaftsführer" },
    format: { fa: "معرفی امکانات، مترو، مدارس و مراکز خرید نزدیک ملک", en: "An overview of amenities, transit, schools, and shopping near the property", de: "Ein Überblick über Annehmlichkeiten, ÖPNV, Schulen und Einkaufsmöglichkeiten in der Nähe der Immobilie" },
    why: { fa: "خریداران/مستأجران قبل از تماس دنبال همین اطلاعات‌اند", en: "Buyers/renters look for exactly this information before reaching out", de: "Käufer/Mieter suchen genau diese Informationen, bevor sie Kontakt aufnehmen" },
  },
  {
    title: { fa: "سوالات متداول خریداران", en: "Buyer FAQ", de: "Häufige Käuferfragen" },
    format: { fa: "استوری Q&A درباره وام، رهن، مراحل قرارداد", en: "A Q&A story about financing, mortgages, and contract steps", de: "Eine Q&A-Story zu Finanzierung, Hypotheken und Vertragsschritten" },
    why: { fa: "مخاطبانی که هنوز آماده تماس نیستند را درگیر نگه می‌دارد", en: "Keeps audiences who aren't ready to reach out yet engaged", de: "Hält Zielgruppen bei der Stange, die noch nicht bereit für den Kontakt sind" },
  },
]);
