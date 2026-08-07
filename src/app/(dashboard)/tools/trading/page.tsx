"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation } from "@/lib/i18n";

export default function TradingPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  return (
    <ToolPage
      title={isFa ? "تحلیل بازارهای مالی" : "Financial Market Analysis"}
      description={isFa ? "تحلیل تکنیکال و بنیادی برای فارکس و ارز دیجیتال" : "Technical and fundamental analysis for forex and cryptocurrency"}
      systemPrompt={
        isFa
          ? "تو یک تحلیلگر بازارهای مالی هستی که تحلیل‌های تکنیکال و بنیادی ارائه می‌دهی. تأکید کن که این مشاوره سرمایه‌گذاری نیست و کاربر باید ریسک‌ها را خودش مدیریت کند. همیشه به فارسی پاسخ بده."
          : "You are a financial markets analyst who provides technical and fundamental analysis. Emphasize that this is not investment advice and the user must manage their own risks. Always respond in English."
      }
      fields={[
        { key: "pair", label: isFa ? "جفت ارز یا دارایی" : "Currency pair or asset", placeholder: isFa ? "مثال: BTC/USDT، EUR/USD، طلا..." : "e.g. BTC/USDT, EUR/USD, gold..." },
        { key: "timeframe", label: isFa ? "تایم‌فریم" : "Timeframe", placeholder: isFa ? "مثال: ۱ ساعته، روزانه، هفتگی..." : "e.g. 1-hour, daily, weekly..." },
        { key: "style", label: isFa ? "سبک معاملاتی" : "Trading style", placeholder: isFa ? "مثال: اسکالپ، سوئینگ، بلند مدت..." : "e.g. scalping, swing, long-term..." },
      ]}
      promptTemplate={({ pair, timeframe, style }) =>
        isFa
          ? `⚠️ این درخواست فقط برای اهداف آموزشی است.\n\nتحلیل ${pair} در تایم‌فریم ${timeframe} با سبک ${style} را ارائه بده. سطوح حمایت و مقاومت، اندیکاتورهای مهم و سناریوهای احتمالی را بررسی کن.`
          : `⚠️ This request is for educational purposes only.\n\nProvide an analysis of ${pair} on the ${timeframe} timeframe with a ${style} trading style. Cover support and resistance levels, key indicators, and possible scenarios.`
      }
    />
  );
}
