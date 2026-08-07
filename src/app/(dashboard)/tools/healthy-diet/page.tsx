"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation } from "@/lib/i18n";

export default function HealthyDietPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  return (
    <ToolPage
      title={isFa ? "برنامه غذایی سالم" : "Healthy Diet Plan"}
      description={isFa ? "برنامه غذایی شخصی‌سازی‌شده متناسب با اهداف و شرایط بدنی شما" : "A personalized diet plan tailored to your goals and physical condition"}
      systemPrompt={
        isFa
          ? "تو یک متخصص تغذیه هستی. برنامه‌های غذایی علمی، سالم و عملی با توجه به شرایط جسمانی و اهداف کاربر ارائه بده. تأکید کن که برای بیماری‌های خاص حتماً با پزشک مشورت شود. همیشه به فارسی پاسخ بده."
          : "You are a nutrition specialist. Provide scientific, healthy, and practical diet plans based on the user's physical condition and goals. Emphasize that for specific medical conditions, a doctor must be consulted. Always respond in English."
      }
      fields={[
        { key: "age", label: isFa ? "سن" : "Age", placeholder: isFa ? "مثال: ۳۰" : "e.g. 30" },
        { key: "weight", label: isFa ? "وزن (کیلوگرم)" : "Weight (kg)", placeholder: isFa ? "مثال: ۷۵" : "e.g. 75" },
        { key: "height", label: isFa ? "قد (سانتیمتر)" : "Height (cm)", placeholder: isFa ? "مثال: ۱۷۵" : "e.g. 175" },
        { key: "goal", label: isFa ? "هدف" : "Goal", placeholder: isFa ? "مثال: کاهش وزن، افزایش عضله، سلامت عمومی..." : "e.g. weight loss, muscle gain, general health..." },
        { key: "conditions", label: isFa ? "بیماری خاص (اگر دارید)" : "Medical conditions (if any)", placeholder: isFa ? "مثال: دیابت، فشار خون، بدون بیماری..." : "e.g. diabetes, high blood pressure, none..." },
      ]}
      promptTemplate={({ age, weight, height, goal, conditions }) =>
        isFa
          ? `یک برنامه غذایی هفتگی برای من تهیه کن:\n- سن: ${age} سال\n- وزن: ${weight} کیلوگرم\n- قد: ${height} سانتیمتر\n- هدف: ${goal}\n- شرایط خاص: ${conditions}\n\nبرنامه هفتگی کامل با صبحانه، ناهار، شام و میان‌وعده بده.`
          : `Prepare a weekly diet plan for me:\n- Age: ${age} years\n- Weight: ${weight} kg\n- Height: ${height} cm\n- Goal: ${goal}\n- Medical conditions: ${conditions}\n\nProvide a complete weekly plan with breakfast, lunch, dinner, and snacks.`
      }
    />
  );
}
