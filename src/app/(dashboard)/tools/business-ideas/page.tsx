"use client";

import ToolPage from "@/components/chat/ToolPage";

export default function BusinessIdeasPage() {
  return (
    <ToolPage
      title="ایده‌های کسب‌وکار"
      description="با هوش مصنوعی ایده‌های کسب‌وکار متناسب با شرایط شما بیابید"
      systemPrompt="تو یک مشاور کسب‌وکار ایرانی حرفه‌ای هستی. ایده‌های کسب‌وکار خلاقانه و عملی با تحلیل سود/زیان و مراحل اجرا ارائه بده. همیشه به فارسی پاسخ بده."
      fields={[
        { key: "field", label: "حوزه فعالیت", placeholder: "مثال: فناوری، غذا، آموزش..." },
        { key: "budget", label: "بودجه اولیه (تومان)", placeholder: "مثال: ۵۰ میلیون تومان" },
        { key: "experience", label: "تجربه و مهارت شما", placeholder: "مثال: برنامه‌نویسی، آشپزی..." },
        { key: "city", label: "شهر", placeholder: "مثال: تهران، اصفهان..." },
      ]}
      promptTemplate={({ field, budget, experience, city }) =>
        `می‌خواهم ایده‌های کسب‌وکار برای شرایط زیر داشته باشم:\n- حوزه: ${field}\n- بودجه: ${budget}\n- تجربه: ${experience}\n- شهر: ${city}\n\nلطفاً ۵ ایده با تحلیل سود/زیان و مراحل اجرا ارائه بده.`
      }
    />
  );
}
