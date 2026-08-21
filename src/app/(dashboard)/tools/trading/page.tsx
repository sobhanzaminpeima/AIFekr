"use client";

import ToolPage from "@/components/chat/ToolPage";
import { useTranslation, tri } from "@/lib/i18n";

export default function TradingPage() {
  const { lang } = useTranslation();

  return (
    <ToolPage
      title={tri(lang, "تحلیل بازارهای مالی", "Financial Market Analysis", "Finanzmarkt-Analyse")}
      description={tri(lang, "تحلیل تکنیکال و بنیادی برای فارکس و ارز دیجیتال", "Technical and fundamental analysis for forex and cryptocurrency", "Technische und fundamentale Analyse für Forex und Kryptowährungen")}
      systemPrompt={
        lang === "fa"
          ? "تو یک تحلیلگر بازارهای مالی هستی که تحلیل‌های تکنیکال و بنیادی ارائه می‌دهی. تأکید کن که این مشاوره سرمایه‌گذاری نیست و کاربر باید ریسک‌ها را خودش مدیریت کند. همیشه به فارسی پاسخ بده."
          : lang === "de"
            ? "Du bist ein Finanzmarktanalyst, der technische und fundamentale Analysen durchführt. Betonen Sie, dass dies keine Anlageberatung ist und der Nutzer seine eigenen Risiken verwalten muss. Antworte immer auf Deutsch."
            : "You are a financial markets analyst who provides technical and fundamental analysis. Emphasize that this is not investment advice and the user must manage their own risks. Always respond in English."
      }
      fields={[
        { key: "pair", label: tri(lang, "جفت ارز یا دارایی", "Currency pair or asset", "Währungspaar oder Vermögenswert"), placeholder: tri(lang, "مثال: BTC/USDT، EUR/USD، طلا...", "e.g. BTC/USDT, EUR/USD, gold...", "z.B. BTC/USDT, EUR/USD, Gold...") },
        { key: "timeframe", label: tri(lang, "تایم‌فریم", "Timeframe", "Zeitrahmen"), placeholder: tri(lang, "مثال: ۱ ساعته، روزانه، هفتگی...", "e.g. 1-hour, daily, weekly...", "z.B. 1-Stunden, täglich, wöchentlich...") },
        { key: "style", label: tri(lang, "سبک معاملاتی", "Trading style", "Handelsstil"), placeholder: tri(lang, "مثال: اسکالپ، سوئینگ، بلند مدت...", "e.g. scalping, swing, long-term...", "z.B. Scalping, Swing, langfristig...") },
      ]}
      promptTemplate={({ pair, timeframe, style }) =>
        lang === "fa"
          ? `⚠️ این درخواست فقط برای اهداف آموزشی است.\\n\\nتحلیل ${pair} در تایم‌فریم ${timeframe} با سبک ${style} را ارائه بده. سطوح حمایت و مقاومت، اندیکاتورهای مهم و سناریوهای احتمالی را بررسی کن.`
          : lang === "de"
            ? `⚠️ Diese Anfrage dient nur zu Bildungszwecken.\\n\\nErstellen Sie eine Analyse von ${pair} im Zeitrahmen ${timeframe} mit dem Handelsstil ${style}. Behandeln Sie Unterstützungs- und Widerstandsniveaus, wichtige Indikatoren und mögliche Szenarien.`
            : `⚠️ This request is for educational purposes only.\\n\\nProvide an analysis of ${pair} on the ${timeframe} timeframe with a ${style} trading style. Cover support and resistance levels, key indicators, and possible scenarios.`
      }
    />
  );
}
