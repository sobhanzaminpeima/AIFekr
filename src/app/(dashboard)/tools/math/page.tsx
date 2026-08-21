"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation, tri } from "@/lib/i18n";

export default function MathPage() {
  const { lang } = useTranslation();

  return (
    <ToolPage
      title={tri(lang, "حل مسائل ریاضی", "Math Problem Solver", "Mathematik-Löser")}
      description={tri(lang, "مسائل ریاضی خود را با حل کامل و توضیح مرحله به مرحله دریافت کنید", "Get your math problems solved completely with step-by-step explanations", "Lösen Sie Ihre Mathematikprobleme mit vollständiger Schritt-für-Schritt-Erklärung")}
      systemPrompt={
        lang === "fa"
          ? "تو یک استاد ریاضیات متخصص هستی. مسائل ریاضی را گام‌به‌گام حل کن، هر مرحله را توضیح بده و فرمول‌های مورد استفاده را ذکر کن. از نماد ریاضی استاندارد استفاده کن. همیشه به فارسی توضیح بده."
          : lang === "de"
            ? "Du bist ein Experte für Mathematik. Löse Mathematikprobleme Schritt für Schritt, erkläre jeden Schritt und nenne die verwendeten Formeln. Verwende die Standard-Mathematiknotation. Erkläre immer auf Deutsch."
            : "You are an expert mathematics professor. Solve math problems step by step, explain each step, and state the formulas used. Use standard mathematical notation. Always explain in English."
      }
      fields={[
        { key: "problem", label: tri(lang, "مسئله ریاضی", "Math problem", "Mathematik-Aufgabe"), placeholder: tri(lang, "مثال: انتگرال sin(x)cos(x) را محاسبه کنید...", "e.g. Compute the integral of sin(x)cos(x)...", "z.B. Berechnen Sie das Integral von sin(x)cos(x)...") },
        { key: "level", label: tri(lang, "سطح تحصیلی", "Education level", "Bildungsniveau"), placeholder: tri(lang, "مثال: دبیرستان، دانشگاه، المپیاد...", "e.g. high school, university, olympiad...", "z.B. Gymnasium, Universität, Olympiade...") },
      ]}
      promptTemplate={({ problem, level }) =>
        lang === "fa"
          ? `این مسئله ریاضی را حل کن:\\n${problem}\\n\\nسطح: ${level}\\n\\nلطفاً گام‌به‌گام با توضیح کامل حل کن.`
          : lang === "de"
            ? `Lösen Sie diese Mathematikaufgabe:\\n${problem}\\n\\nNiveau: ${level}\\n\\nBitte Schritt für Schritt mit vollständiger Erklärung lösen.`
            : `Solve this math problem:\\n${problem}\\n\\nLevel: ${level}\\n\\nPlease solve it step by step with a complete explanation.`
      }
    />
  );
}
