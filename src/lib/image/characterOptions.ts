/** Production styles of the character board, shared by the classic panel and the new design. */
export type Genre = "cinematic_drama" | "luxury_editorial" | "sci_fi" | "fantasy" | "business_corporate" | "streetwear_urban" | "minimal_tech";
export const CHARACTER_GENRES: { value: Genre; fa: string; en: string; de: string }[] = [
  { value: "cinematic_drama", fa: "درام سینمایی", en: "Cinematic Drama", de: "Kinodrama" },
  { value: "luxury_editorial", fa: "ادیتوریال لوکس", en: "Luxury Editorial", de: "Luxus-Editorial" },
  { value: "sci_fi", fa: "علمی‌تخیلی", en: "Sci-Fi", de: "Science-Fiction" },
  { value: "fantasy", fa: "فانتزی", en: "Fantasy", de: "Fantasy" },
  { value: "business_corporate", fa: "کسب‌وکار / شرکتی", en: "Business / Corporate", de: "Business / Unternehmen" },
  { value: "streetwear_urban", fa: "خیابانی / شهری", en: "Streetwear / Urban", de: "Streetwear / Urban" },
  { value: "minimal_tech", fa: "تک مینیمال", en: "Minimal Tech", de: "Minimal Tech" },
];
