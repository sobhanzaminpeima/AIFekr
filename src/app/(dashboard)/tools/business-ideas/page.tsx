"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation } from "@/lib/i18n";

export default function BusinessIdeasPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  return (
    <ToolPage
      title={isFa ? "ایده‌های کسب‌وکار" : "Business Ideas"}
      description={isFa ? "با هوش مصنوعی ایده‌های کسب‌وکار متناسب با شرایط شما بیابید" : "Find business ideas tailored to your situation with AI"}
      systemPrompt={
        isFa
          ? "تو یک مشاور کسب‌وکار ایرانی حرفه‌ای هستی. ایده‌های کسب‌وکار خلاقانه و عملی با تحلیل سود/زیان و مراحل اجرا ارائه بده. همیشه به فارسی پاسخ بده."
          : "You are a professional business consultant. Provide creative, practical business ideas with a profit/loss analysis and execution steps. Always respond in English."
      }
      fields={[
        { key: "field", label: isFa ? "حوزه فعالیت" : "Field of activity", placeholder: isFa ? "مثال: فناوری، غذا، آموزش..." : "e.g. technology, food, education..." },
        { key: "budget", label: isFa ? "بودجه اولیه (تومان)" : "Initial budget", placeholder: isFa ? "مثال: ۵۰ میلیون تومان" : "e.g. $10,000" },
        { key: "experience", label: isFa ? "تجربه و مهارت شما" : "Your experience and skills", placeholder: isFa ? "مثال: برنامه‌نویسی، آشپزی..." : "e.g. programming, cooking..." },
        { key: "city", label: isFa ? "شهر" : "City", placeholder: isFa ? "مثال: تهران، اصفهان..." : "e.g. Tehran, New York..." },
      ]}
      promptTemplate={({ field, budget, experience, city }) =>
        isFa
          ? `می‌خواهم ایده‌های کسب‌وکار برای شرایط زیر داشته باشم:\n- حوزه: ${field}\n- بودجه: ${budget}\n- تجربه: ${experience}\n- شهر: ${city}\n\nلطفاً ۵ ایده با تحلیل سود/زیان و مراحل اجرا ارائه بده.`
          : `I want business ideas for the following conditions:\n- Field: ${field}\n- Budget: ${budget}\n- Experience: ${experience}\n- City: ${city}\n\nPlease provide 5 ideas with a profit/loss analysis and execution steps.`
      }
    />
  );
}
