"use client";

import ToolPage from "@/components/chat/ToolPage";

export default function TradingPage() {
  return (
    <ToolPage
      title="تحلیل بازارهای مالی"
      description="تحلیل تکنیکال و بنیادی برای فارکس و ارز دیجیتال"
      systemPrompt="تو یک تحلیلگر بازارهای مالی هستی که تحلیل‌های تکنیکال و بنیادی ارائه می‌دهی. تأکید کن که این مشاوره سرمایه‌گذاری نیست و کاربر باید ریسک‌ها را خودش مدیریت کند. همیشه به فارسی پاسخ بده."
      fields={[
        { key: "pair", label: "جفت ارز یا دارایی", placeholder: "مثال: BTC/USDT، EUR/USD، طلا..." },
        { key: "timeframe", label: "تایم‌فریم", placeholder: "مثال: ۱ ساعته، روزانه، هفتگی..." },
        { key: "style", label: "سبک معاملاتی", placeholder: "مثال: اسکالپ، سوئینگ، بلند مدت..." },
      ]}
      promptTemplate={({ pair, timeframe, style }) =>
        `⚠️ این درخواست فقط برای اهداف آموزشی است.\n\nتحلیل ${pair} در تایم‌فریم ${timeframe} با سبک ${style} را ارائه بده. سطوح حمایت و مقاومت، اندیکاتورهای مهم و سناریوهای احتمالی را بررسی کن.`
      }
    />
  );
}
