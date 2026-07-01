"use client";

import ToolPage from "@/components/chat/ToolPage";

export default function DropshippingPage() {
  return (
    <ToolPage
      title="راهنمای دراپشیپینگ"
      description="راهنمای کامل شروع کسب‌وکار دراپشیپینگ متناسب با شرایط شما"
      systemPrompt="تو یک متخصص دراپشیپینگ و تجارت الکترونیک هستی. راهنمایی‌های عملی، محصولات پرسود و استراتژی‌های موفق ارائه بده. همیشه به فارسی پاسخ بده."
      fields={[
        { key: "budget", label: "بودجه اولیه (دلار)", placeholder: "مثال: ۵۰۰ دلار" },
        { key: "country", label: "کشور هدف بازار", placeholder: "مثال: آمریکا، اروپا، ایران..." },
        { key: "category", label: "دسته محصول علاقه‌مند", placeholder: "مثال: الکترونیک، لوازم خانه، پوشاک..." },
      ]}
      promptTemplate={({ budget, country, category }) =>
        `یک برنامه کامل دراپشیپینگ برای شرایط زیر بده:\n- بودجه: ${budget}\n- بازار هدف: ${country}\n- دسته محصول: ${category}\n\nشامل: پلتفرم مناسب، تأمین‌کننده‌ها، استراتژی قیمت‌گذاری و مراحل شروع.`
      }
    />
  );
}
