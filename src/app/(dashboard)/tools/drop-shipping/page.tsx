"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation } from "@/lib/i18n";

export default function DropshippingPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  return (
    <ToolPage
      title={isFa ? "راهنمای دراپشیپینگ" : "Dropshipping Guide"}
      description={isFa ? "راهنمای کامل شروع کسب‌وکار دراپشیپینگ متناسب با شرایط شما" : "A complete guide to starting a dropshipping business tailored to your situation"}
      systemPrompt={
        isFa
          ? "تو یک متخصص دراپشیپینگ و تجارت الکترونیک هستی. راهنمایی‌های عملی، محصولات پرسود و استراتژی‌های موفق ارائه بده. همیشه به فارسی پاسخ بده."
          : "You are a dropshipping and e-commerce specialist. Provide practical guidance, profitable products, and successful strategies. Always respond in English."
      }
      fields={[
        { key: "budget", label: isFa ? "بودجه اولیه (دلار)" : "Initial budget (USD)", placeholder: isFa ? "مثال: ۵۰۰ دلار" : "e.g. $500" },
        { key: "country", label: isFa ? "کشور هدف بازار" : "Target market country", placeholder: isFa ? "مثال: آمریکا، اروپا، ایران..." : "e.g. USA, Europe, Iran..." },
        { key: "category", label: isFa ? "دسته محصول علاقه‌مند" : "Product category of interest", placeholder: isFa ? "مثال: الکترونیک، لوازم خانه، پوشاک..." : "e.g. electronics, home goods, apparel..." },
      ]}
      promptTemplate={({ budget, country, category }) =>
        isFa
          ? `یک برنامه کامل دراپشیپینگ برای شرایط زیر بده:\n- بودجه: ${budget}\n- بازار هدف: ${country}\n- دسته محصول: ${category}\n\nشامل: پلتفرم مناسب، تأمین‌کننده‌ها، استراتژی قیمت‌گذاری و مراحل شروع.`
          : `Provide a complete dropshipping plan for the following conditions:\n- Budget: ${budget}\n- Target market: ${country}\n- Product category: ${category}\n\nInclude: the right platform, suppliers, pricing strategy, and steps to get started.`
      }
    />
  );
}
