"use client";

import ToolPage from "@/components/chat/ToolPage";

export default function MathPage() {
  return (
    <ToolPage
      title="حل مسائل ریاضی"
      description="مسائل ریاضی خود را با حل کامل و توضیح مرحله به مرحله دریافت کنید"
      systemPrompt="تو یک استاد ریاضیات متخصص هستی. مسائل ریاضی را گام‌به‌گام حل کن، هر مرحله را توضیح بده و فرمول‌های مورد استفاده را ذکر کن. از نماد ریاضی استاندارد استفاده کن. همیشه به فارسی توضیح بده."
      fields={[
        { key: "problem", label: "مسئله ریاضی", placeholder: "مثال: انتگرال sin(x)cos(x) را محاسبه کنید..." },
        { key: "level", label: "سطح تحصیلی", placeholder: "مثال: دبیرستان، دانشگاه، المپیاد..." },
      ]}
      promptTemplate={({ problem, level }) =>
        `این مسئله ریاضی را حل کن:\n${problem}\n\nسطح: ${level}\n\nلطفاً گام‌به‌گام با توضیح کامل حل کن.`
      }
    />
  );
}
