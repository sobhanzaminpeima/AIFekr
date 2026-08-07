"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation } from "@/lib/i18n";

export default function MathPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  return (
    <ToolPage
      title={isFa ? "حل مسائل ریاضی" : "Math Problem Solver"}
      description={isFa ? "مسائل ریاضی خود را با حل کامل و توضیح مرحله به مرحله دریافت کنید" : "Get your math problems solved completely with step-by-step explanations"}
      systemPrompt={
        isFa
          ? "تو یک استاد ریاضیات متخصص هستی. مسائل ریاضی را گام‌به‌گام حل کن، هر مرحله را توضیح بده و فرمول‌های مورد استفاده را ذکر کن. از نماد ریاضی استاندارد استفاده کن. همیشه به فارسی توضیح بده."
          : "You are an expert mathematics professor. Solve math problems step by step, explain each step, and state the formulas used. Use standard mathematical notation. Always explain in English."
      }
      fields={[
        { key: "problem", label: isFa ? "مسئله ریاضی" : "Math problem", placeholder: isFa ? "مثال: انتگرال sin(x)cos(x) را محاسبه کنید..." : "e.g. Compute the integral of sin(x)cos(x)..." },
        { key: "level", label: isFa ? "سطح تحصیلی" : "Education level", placeholder: isFa ? "مثال: دبیرستان، دانشگاه، المپیاد..." : "e.g. high school, university, olympiad..." },
      ]}
      promptTemplate={({ problem, level }) =>
        isFa
          ? `این مسئله ریاضی را حل کن:\n${problem}\n\nسطح: ${level}\n\nلطفاً گام‌به‌گام با توضیح کامل حل کن.`
          : `Solve this math problem:\n${problem}\n\nLevel: ${level}\n\nPlease solve it step by step with a complete explanation.`
      }
    />
  );
}
