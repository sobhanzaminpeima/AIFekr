"use client";
import { useTranslation, tri } from "@/lib/i18n";
export default function WorkspaceLoading() {
  const { lang } = useTranslation();
  return <div className="workspace-page" role="status" aria-label={tri(lang, "در حال بارگذاری", "Loading workspace", "Arbeitsbereich wird geladen", "Çalışma alanı yükleniyor")}>
    <span className="sr-only">{tri(lang, "در حال بارگذاری…", "Loading…", "Wird geladen…", "Yükleniyor…")}</span>
    <div className="skeleton h-7 w-48 rounded-lg mb-4"/><div className="skeleton h-4 w-64 max-w-full rounded-lg mb-8"/>
    <div className="grid gap-4 sm:grid-cols-3 mb-6">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl"/>)}</div>
    <div className="skeleton h-64 rounded-2xl"/>
  </div>;
}
