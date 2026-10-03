"use client";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  const { lang } = useTranslation();
  return <div className="workspace-page"><section className="workspace-empty" role="alert">
    <AlertCircle size={32} className="mx-auto mb-5" style={{ color: "var(--primary)" }}/>
    <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "این بخش بارگذاری نشد", "This section couldn't load", "Dieser Bereich konnte nicht geladen werden", "Bu bölüm yüklenemedi")}</h2>
    <p className="text-sm mb-6">{tri(lang, "دوباره تلاش کنید یا به خانه برگردید.", "Try again or return to your workspace home.", "Versuchen Sie es erneut oder kehren Sie zur Startseite zurück.", "Tekrar deneyin veya ana sayfaya dönün.")}</p>
    <div className="flex flex-wrap justify-center gap-3"><button onClick={reset} className="workspace-button"><RefreshCw size={16}/>{tri(lang, "تلاش مجدد", "Try again", "Erneut versuchen", "Tekrar dene")}</button><Link href="/home" className="workspace-button secondary">{tri(lang, "خانه", "Home", "Startseite", "Ana sayfa")}</Link></div>
  </section></div>;
}
