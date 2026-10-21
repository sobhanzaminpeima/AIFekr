import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";
import type { CrawlFailure } from "@/lib/seo/urlAudit";

/** User-facing explanation of why a page could not be crawled, in all four UI languages. */
export function crawlFailureMessage(lang: Lang, f: CrawlFailure): string {
  const status = f.reason === "http" ? f.status : 0;
  const refused = f.reason === "http" && [401, 403, 429].includes(f.status);
  if (f.reason === "blocked")
    return tri(lang, "این آدرس قابل بررسی نیست (فقط سایت‌های عمومی اینترنت).", "This address can't be analyzed (public websites only).", "Diese Adresse kann nicht analysiert werden (nur öffentliche Websites).", "Bu adres analiz edilemez (yalnızca herkese açık siteler).");
  if (f.reason === "timeout")
    return tri(lang, "سایت در مدت مجاز پاسخ نداد. کمی بعد دوباره امتحان کنید.", "The site didn't respond in time. Please try again shortly.", "Die Website hat nicht rechtzeitig geantwortet. Bitte versuchen Sie es gleich erneut.", "Site zamanında yanıt vermedi. Lütfen kısa süre sonra tekrar deneyin.");
  if (refused)
    return tri(lang, `سایت شما دسترسی ربات ما را رد می‌کند (کد ${status}). فایروال/محافظ ضدربات را برای AiFekrSEOBot باز کنید.`, `Your site refuses our crawler (status ${status}). Allow AiFekrSEOBot in your firewall / bot protection.`, `Ihre Website verweigert unserem Crawler den Zugriff (Status ${status}). Erlauben Sie AiFekrSEOBot in Firewall/Bot-Schutz.`, `Siteniz tarayıcımızı reddediyor (durum ${status}). AiFekrSEOBot'a güvenlik duvarınızda izin verin.`);
  if (f.reason === "http")
    return tri(lang, `سایت با خطا پاسخ داد (کد ${status}).`, `The site answered with an error (status ${status}).`, `Die Website antwortete mit einem Fehler (Status ${status}).`, `Site bir hata ile yanıt verdi (durum ${status}).`);
  return tri(lang, "به سایت وصل نشدیم. آدرس را بررسی کنید و مطمئن شوید سایت آنلاین است.", "We couldn't reach the site. Check the address and that it is online.", "Die Website ist nicht erreichbar. Prüfen Sie die Adresse und ob sie online ist.", "Siteye ulaşılamadı. Adresi ve sitenin çevrimiçi olduğunu kontrol edin.");
}
