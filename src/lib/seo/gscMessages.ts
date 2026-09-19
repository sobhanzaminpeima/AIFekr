import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";

/**
 * User-facing Search Console messages in every UI language. These were
 * hardcoded Persian in the routes, so English, German and Turkish users saw a
 * Persian error (QA 2026-09-20).
 */
const M = {
  notConnected: ["به Search Console متصل نیستید", "You are not connected to Search Console", "Sie sind nicht mit der Search Console verbunden", "Search Console'a bağlı değilsiniz"],
  noSite: ["هنوز سایتی انتخاب نشده", "No site has been selected yet", "Es wurde noch keine Website ausgewählt", "Henüz bir site seçilmedi"],
  siteRequired: ["انتخاب سایت الزامی است", "A site is required", "Eine Website ist erforderlich", "Bir site gereklidir"],
  reconnect: [
    "اتصال گوگل شما منقضی یا نامعتبر شده است. لطفاً دوباره وارد Google Search Console شوید.",
    "Your Google connection has expired or is no longer valid. Please reconnect Google Search Console.",
    "Ihre Google-Verbindung ist abgelaufen oder ungültig. Bitte verbinden Sie die Google Search Console erneut.",
    "Google bağlantınızın süresi doldu veya geçersiz. Lütfen Google Search Console'u yeniden bağlayın.",
  ],
  unavailable: [
    "اتصال AiFekr به Google Search Console روی سرور کامل فعال نشده است (مشکل تنظیمات ما، نه حساب شما). دوباره وصل کردن کمکی نمی‌کند؛ به پشتیبانی اطلاع دهید.",
    "AiFekr's Search Console access isn't fully enabled on our server (a setup issue on our side, not your account). Reconnecting won't help — please contact support.",
    "Der Search-Console-Zugriff von AiFekr ist auf unserem Server noch nicht vollständig aktiviert (ein Setup-Problem auf unserer Seite, nicht Ihr Konto). Eine erneute Verbindung hilft nicht – bitte kontaktieren Sie den Support.",
    "AiFekr'in Search Console erişimi sunucumuzda tam olarak etkinleştirilmemiş (hesabınızla değil, bizim tarafımızdaki bir kurulum sorunu). Yeniden bağlanmak yardımcı olmaz — lütfen destekle iletişime geçin.",
  ],
  generic: [
    "خطا در ارتباط با Search Console. کمی بعد دوباره تلاش کنید.",
    "Could not reach Search Console. Please try again shortly.",
    "Die Search Console ist nicht erreichbar. Bitte versuchen Sie es gleich erneut.",
    "Search Console'a ulaşılamadı. Lütfen kısa süre sonra tekrar deneyin.",
  ],
} as const;

export type GscMessageKey = keyof typeof M;

export function gscMsg(lang: Lang, key: GscMessageKey): string {
  const [fa, en, de, tr] = M[key];
  return tri(lang, fa, en, de, tr);
}
