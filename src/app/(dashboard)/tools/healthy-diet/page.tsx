"use client";

import ToolPage from "@/components/chat/ToolPage";

export default function HealthyDietPage() {
  return (
    <ToolPage
      title="برنامه غذایی سالم"
      description="برنامه غذایی شخصی‌سازی‌شده متناسب با اهداف و شرایط بدنی شما"
      systemPrompt="تو یک متخصص تغذیه هستی. برنامه‌های غذایی علمی، سالم و عملی با توجه به شرایط جسمانی و اهداف کاربر ارائه بده. تأکید کن که برای بیماری‌های خاص حتماً با پزشک مشورت شود. همیشه به فارسی پاسخ بده."
      fields={[
        { key: "age", label: "سن", placeholder: "مثال: ۳۰" },
        { key: "weight", label: "وزن (کیلوگرم)", placeholder: "مثال: ۷۵" },
        { key: "height", label: "قد (سانتیمتر)", placeholder: "مثال: ۱۷۵" },
        { key: "goal", label: "هدف", placeholder: "مثال: کاهش وزن، افزایش عضله، سلامت عمومی..." },
        { key: "conditions", label: "بیماری خاص (اگر دارید)", placeholder: "مثال: دیابت، فشار خون، بدون بیماری..." },
      ]}
      promptTemplate={({ age, weight, height, goal, conditions }) =>
        `یک برنامه غذایی هفتگی برای من تهیه کن:\n- سن: ${age} سال\n- وزن: ${weight} کیلوگرم\n- قد: ${height} سانتیمتر\n- هدف: ${goal}\n- شرایط خاص: ${conditions}\n\nبرنامه هفتگی کامل با صبحانه، ناهار، شام و میان‌وعده بده.`
      }
    />
  );
}
