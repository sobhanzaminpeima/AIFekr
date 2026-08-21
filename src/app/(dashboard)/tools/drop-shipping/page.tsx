"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation, tri } from "@/lib/i18n";

export default function DropshippingPage() {
  const { lang } = useTranslation();

  return (
    <ToolPage
      title={tri(lang, "راهنمای دراپشیپینگ", "Dropshipping Guide", "Dropshipping-Leitfaden")}
      description={tri(lang, "راهنمای کامل شروع کسب‌وکار دراپشیپینگ متناسب با شرایط شما", "A complete guide to starting a dropshipping business tailored to your situation", "Ein kompletter Leitfaden für den Start eines Dropshipping-Geschäfts, angepasst an Ihre Situation")}
      systemPrompt={
        lang === "fa"
          ? "تو یک متخصص دراپشیپینگ و تجارت الکترونیک هستی. راهنمایی‌های عملی، محصولات پرسود و استراتژی‌های موفق ارائه بده. همیشه به فارسی پاسخ بده."
          : lang === "de"
            ? "Du bist ein Dropshipping- und E-Commerce-Spezialist. Biete praktische Anleitungen, profitable Produkte und erfolgreiche Strategien an. Antworte immer auf Deutsch."
            : "You are a dropshipping and e-commerce specialist. Provide practical guidance, profitable products, and successful strategies. Always respond in English."
      }
      fields={[
        { key: "budget", label: tri(lang, "بودجه اولیه (دلار)", "Initial budget (USD)", "Erstinvestition (EUR)"), placeholder: tri(lang, "مثال: ۵۰۰ دلار", "e.g. $500", "z.B. 500 €") },
        { key: "country", label: tri(lang, "کشور هدف بازار", "Target market country", "Zielmarkt-Land"), placeholder: tri(lang, "مثال: آمریکا، اروپا، ایران...", "e.g. USA, Europe, Iran...", "z.B. USA, Europe, Deutschland...") },
        { key: "category", label: tri(lang, "دسته محصول علاقه‌مند", "Product category of interest", "Produktkategorie von Interesse"), placeholder: tri(lang, "مثال: الکترونیک، لوازم خانه، پوشاک...", "e.g. electronics, home goods, apparel...", "z.B. Elektronik, Haushaltswaren, Bekleidung...") },
      ]}
      promptTemplate={({ budget, country, category }) =>
        lang === "fa"
          ? `یک برنامه کامل دراپشیپینگ برای شرایط زیر بده:\\n- بودجه: ${budget}\\n- بازار هدف: ${country}\\n- دسته محصول: ${category}\\n\\nشامل: پلتفرم مناسب، تأمین‌کننده‌ها، استراتژی قیمت‌گذاری و مراحل شروع.`
          : lang === "de"
            ? `Erstellen Sie einen vollständigen Dropshipping-Plan für folgende Bedingungen:\\n- Budget: ${budget}\\n- Zielmarkt: ${country}\\n- Produktkategorie: ${category}\\n\\nEinschließlich: richtige Plattform, Lieferanten, Preisgestaltung und Schritte zum Start.`
            : `Provide a complete dropshipping plan for the following conditions:\\n- Budget: ${budget}\\n- Target market: ${country}\\n- Product category: ${category}\\n\\nInclude: the right platform, suppliers, pricing strategy, and steps to get started.`
      }
    />
  );
}
