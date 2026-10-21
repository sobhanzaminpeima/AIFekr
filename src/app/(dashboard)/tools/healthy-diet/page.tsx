"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation, tri } from "@/lib/i18n";

export default function HealthyDietPage() {
  const { lang } = useTranslation();

  return (
    <ToolPage
      title={tri(lang, "برنامه غذایی سالم", "Healthy Diet Plan", "Gesunder Ernährungsplan")}
      description={tri(lang, "برنامه غذایی شخصی‌سازی‌شده متناسب با اهداف و شرایط بدنی شما", "A personalized diet plan tailored to your goals and physical condition", "Ein personalisierter Ernährungsplan, angepasst an Ihre Ziele und körperliche Verfassung")}
      systemPrompt={
        lang === "fa"
          ? "تو یک متخصص تغذیه هستی. برنامه‌های غذایی علمی، سالم و عملی با توجه به شرایط جسمانی و اهداف کاربر ارائه بده. تأکید کن که برای بیماری‌های خاص حتماً با پزشک مشورت شود. همیشه به فارسی پاسخ بده."
          : lang === "de"
            ? "Du bist ein Ernährungsexperte. Biete wissenschaftliche, gesunde und praktische Ernährungspläne basierend auf dem körperlichen Zustand und den Zielen des Nutzers an. Betone, dass bei bestimmten medizinischen Zuständen ein Arzt konsultiert werden muss. Antworte immer auf Deutsch."
            : "You are a nutrition specialist. Provide scientific, healthy, and practical diet plans based on the user's physical condition and goals. Emphasize that for specific medical conditions, a doctor must be consulted. Always respond in English."
      }
      fields={[
        { key: "age", label: tri(lang, "سن", "Age", "Alter"), placeholder: tri(lang, "مثال: ۳۰", "e.g. 30", "z.B. 30") },
        { key: "weight", label: tri(lang, "وزن (کیلوگرم)", "Weight (kg)", "Gewicht (kg)"), placeholder: tri(lang, "مثال: ۷۵", "e.g. 75", "z.B. 75") },
        { key: "height", label: tri(lang, "قد (سانتیمتر)", "Height (cm)", "Größe (cm)"), placeholder: tri(lang, "مثال: ۱۷۵", "e.g. 175", "z.B. 175") },
        { key: "goal", label: tri(lang, "هدف", "Goal", "Ziel"), placeholder: tri(lang, "مثال: کاهش وزن، افزایش عضله، سلامت عمومی...", "e.g. weight loss, muscle gain, general health...", "z.B. Gewichtsverlust, Muskelaufbau, allgemeine Gesundheit...") },
        { key: "conditions", label: tri(lang, "بیماری خاص (اگر دارید)", "Medical conditions (if any)", "Medizinische Vorerkrankungen (falls vorhanden)"), placeholder: tri(lang, "مثال: دیابت، فشار خون، بدون بیماری...", "e.g. diabetes, high blood pressure, none...", "z.B. Diabetes, Bluthochdruck, keine...") },
      ]}
      promptTemplate={({ age, weight, height, goal, conditions }) =>
        lang === "fa"
          ? `یک برنامه غذایی هفتگی برای من تهیه کن:\\n- سن: ${age} سال\\n- وزن: ${weight} کیلوگرم\\n- قد: ${height} سانتیمتر\\n- هدف: ${goal}\\n- شرایط خاص: ${conditions}\\n\\nبرنامه هفتگی کامل با صبحانه، ناهار، شام و میان‌وعده بده.`
          : lang === "de"
            ? `Erstellen Sie einen wöchentlichen Ernährungsplan für mich:\\n- Alter: ${age} Jahre\\n- Gewicht: ${weight} kg\\n- Größe: ${height} cm\\n- Ziel: ${goal}\\n- Medizinische Vorerkrankungen: ${conditions}\\n\\nBitte einen vollständigen Wochenplan mit Frühstück, Mittagessen, Abendessen und Snacks.`
            : `Prepare a weekly diet plan for me:\\n- Age: ${age} years\\n- Weight: ${weight} kg\\n- Height: ${height} cm\\n- Goal: ${goal}\\n- Medical conditions: ${conditions}\\n\\nProvide a complete weekly plan with breakfast, lunch, dinner, and snacks.`
      }
    />
  );
}
