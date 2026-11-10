import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/server";
import { fitCopy } from "@/lib/fitness/copy";
import { absoluteUrl, pageMetadata, SITE_URL } from "@/lib/seo/site";
import { searchTargets } from "@/lib/seo/searchTargets";

/** The public AIFekr FIT landing page: same wording, SEO and links as the classic page. */
const PUBLIC = {
  en: { login: "Sign in", create: "Create account", coaches: "AI coaches built around your goals", explore: "Explore coaches", proof: "Programs · workout tracking · progress reports", findCoach: "Find your human coach", findCoachLink: "Explore trainers & availability", sell: "Sell as a trainer", sellBody: "Apply, submit credentials and publish after admin review.", sellLink: "Trainer application" },
  fa: { login: "ورود", create: "ساخت حساب", coaches: "مربی‌های هوشمند متناسب با هدف تو", explore: "مشاهده مربی‌ها", proof: "برنامه تمرینی · ثبت تمرین · گزارش پیشرفت", findCoach: "مربی انسانی مناسب خودت را پیدا کن", findCoachLink: "مشاهده مربیان و زمان‌های رزرو", sell: "به‌عنوان مربی فعالیت کن", sellBody: "درخواست و مدارکت را بفرست؛ پس از بررسی ادمین فعالیتت را شروع کن.", sellLink: "درخواست مربی شدن" },
  tr: { login: "Giriş yap", create: "Hesap oluştur", coaches: "Hedeflerine göre yapay zekâ koçları", explore: "Koçları keşfet", proof: "Programlar · antrenman takibi · ilerleme raporları", findCoach: "İnsan eğitmenini bul", findCoachLink: "Eğitmenleri ve uygun saatleri keşfet", sell: "Eğitmen olarak satış yap", sellBody: "Başvur, belgelerini gönder ve inceleme sonrasında yayınla.", sellLink: "Eğitmen başvurusu" },
  de: { login: "Anmelden", create: "Konto erstellen", coaches: "KI-Coaches passend zu deinen Zielen", explore: "Coaches entdecken", proof: "Programme · Trainingsprotokoll · Fortschrittsberichte", findCoach: "Finde deinen Trainer", findCoachLink: "Trainer und Termine ansehen", sell: "Als Trainer verkaufen", sellBody: "Bewirb dich und reiche Nachweise zur Prüfung ein.", sellLink: "Trainerbewerbung" },
} as const;

export type FitLanding = Record<string, string>;

export function fitPage(lang: Lang): { metadata: Metadata; jsonLd: Record<string, unknown>[]; fit: FitLanding } {
  const c = fitCopy[lang] as unknown as Record<string, string>;
  const pick = ["title", "tagline", "safety", "start", "trainers", "ai", "programs", "nutrition", "gym", "history", "subscription", "plans", "profile"];
  const fit: FitLanding = { ...Object.fromEntries(pick.map((k) => [k, c[k] ?? ""])), ...PUBLIC[lang] };
  const target = searchTargets["/fit"];
  return {
    metadata: pageMetadata(lang, "/fit", target.title, target.description),
    jsonLd: [{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "AIFekr FIT", description: target.description[lang], applicationCategory: "HealthApplication", operatingSystem: "Web", url: absoluteUrl("/fit"), publisher: { "@type": "Organization", name: "AIFekr", url: SITE_URL } }],
    fit,
  };
}
