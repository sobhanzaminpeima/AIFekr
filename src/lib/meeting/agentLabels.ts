import type { Lang } from "@/lib/i18n";

const LABELS: Record<string, [string, string, string, string]> = {
  ceo: ["مدیرعامل", "CEO", "CEO", "CEO"],
  marketing: ["بازاریابی", "Marketing", "Marketing", "Pazarlama"],
  finance: ["مالی", "Finance", "Finanzen", "Finans"],
  seo: ["سئو", "SEO", "SEO", "SEO"],
  sales: ["فروش", "Sales", "Vertrieb", "Satış"],
  product: ["محصول", "Product", "Produkt", "Ürün"],
  legal: ["حقوقی", "Legal", "Recht", "Hukuk"],
};
const INDEX: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };

/** Meeting agents as people read them; the saved meeting used to show raw keys like "ceo, sales". */
export function agentLabels(keys: string[], lang: Lang): string {
  return keys.map((k) => LABELS[k]?.[INDEX[lang] ?? 1] ?? k).join(lang === "fa" ? "، " : ", ");
}
