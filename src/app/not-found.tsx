import Link from "next/link";
import { getServerLang } from "@/lib/i18n/server";
import { copy, text } from "@/lib/marketing/catalog";
import PublicShell from "@/components/marketing/PublicShell";
export default async function NotFound() {
  const lang = await getServerLang();
  return <PublicShell lang={lang}><section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">404 / AIFekr</span><h1>{text(lang, ["این صفحه پیدا نشد.", "This page wasn't found.", "Diese Seite wurde nicht gefunden.", "Bu sayfa bulunamadı."])}</h1><p>{text(lang, ["از صفحهٔ اصلی یا فهرست قابلیت‌ها مسیرتان را ادامه دهید.", "Continue from the homepage or explore our features.", "Von der Startseite aus fortfahren oder Funktionen entdecken.", "Ana sayfadan devam edin veya özellikleri keşfedin."])}</p><div className="m-actions"><Link className="m-button" href="/">{text(lang, copy.explore)}</Link><Link className="m-button m-secondary" href="/contact">{text(lang, copy.contact)}</Link></div></div></section></PublicShell>;
}
