"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation, tri } from "@/lib/i18n";

export default function BusinessIdeasPage() {
  const { lang } = useTranslation();

  return (
    <ToolPage
      title={tri(lang, "ایده‌های کسب‌وکار", "Business Ideas", "Geschäftsideen")}
      description={tri(lang, "با هوش مصنوعی ایده‌های کسب‌وکار متناسب با شرایط شما بیابید", "Find business ideas tailored to your situation with AI", "Finden Sie mit KI Geschäftsideen, die zu Ihrer Situation passen")}
      systemPrompt={
        lang === "fa"
          ? "تو یک مشاور کسب‌وکار ایرانی حرفه‌ای هستی. ایده‌های کسب‌وکار خلاقانه و عملی با تحلیل سود/زیان و مراحل اجرا ارائه بده. همیشه به فارسی پاسخ بده."
          : lang === "de"
            ? "Du bist ein professioneller Unternehmensberater. Biete kreative, praktische Geschäftsideen mit Gewinn/Verlust-Analyse und Umsetzungsschritten an. Antworte immer auf Deutsch."
            : "You are a professional business consultant. Provide creative, practical business ideas with a profit/loss analysis and execution steps. Always respond in English."
      }
      fields={[
        { key: "field", label: tri(lang, "حوزه فعالیت", "Field of activity", "Tätigkeitsbereich"), placeholder: tri(lang, "مثال: فناوری، غذا، آموزش...", "e.g. technology, food, education...", "z.B. Technologie, Essen, Bildung...") },
        { key: "budget", label: tri(lang, "بودجه اولیه (تومان)", "Initial budget", "Erstinvestition"), placeholder: tri(lang, "مثال: ۵۰ میلیون تومان", "e.g. $10,000", "z.B. 10.000 €") },
        { key: "experience", label: tri(lang, "تجربه و مهارت شما", "Your experience and skills", "Ihre Erfahrung und Fähigkeiten"), placeholder: tri(lang, "مثال: برنامه‌نویسی، آشپزی...", "e.g. programming, cooking...", "z.B. Programmieren, Kochen...") },
        { key: "city", label: tri(lang, "شهر", "City", "Stadt"), placeholder: tri(lang, "مثال: تهران، اصفهان...", "e.g. Tehran, New York...", "z.B. Berlin, München...") },
      ]}
      promptTemplate={({ field, budget, experience, city }) =>
        lang === "fa"
          ? `می‌خواهم ایده‌های کسب‌وکار برای شرایط زیر داشته باشم:\\n- حوزه: ${field}\\n- بودجه: ${budget}\\n- تجربه: ${experience}\\n- شهر: ${city}\\n\\nلطفاً ۵ ایده با تحلیل سود/زیان و مراحل اجرا ارائه بده.`
          : lang === "de"
            ? `Ich möchte Geschäftsideen für folgende Bedingungen:\\n- Bereich: ${field}\\n- Budget: ${budget}\\n- Erfahrung: ${experience}\\n- Stadt: ${city}\\n\\nBitte 5 Ideen mit Gewinn/Verlust-Analyse und Umsetzungsschritten.`
            : `I want business ideas for the following conditions:\\n- Field: ${field}\\n- Budget: ${budget}\\n- Experience: ${experience}\\n- City: ${city}\\n\\nPlease provide 5 ideas with a profit/loss analysis and execution steps.`
      }
    />
  );
}
