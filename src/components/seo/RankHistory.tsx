"use client";
import { useEffect, useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
type Observation = { id: string; keyword: string; locationCode: number; languageCode: string; device: string; position: number | null; checkedAt: string; depth: number };
export default function RankHistory({ siteId, revision }: { siteId: string; revision: string }) {
  const { lang } = useTranslation();
  const text = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const [rows, setRows] = useState<Observation[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setRows([]); setFailed(false); setLoading(true);
    fetch(`/api/seo/intelligence/ranks?siteId=${encodeURIComponent(siteId)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!controller.signal.aborted) setRows(data.observations);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, revision]);
  return <section className="rounded-2xl border border-[var(--border)] p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><TrendingUp size={18} />{text("تاریخچه رتبه سایت", "Website rank history", "Rangverlauf der Website", "Site sıralama geçmişi")}</h2>{rows.length > 0 && <a href={`/api/seo/intelligence/ranks?siteId=${encodeURIComponent(siteId)}&format=csv`} className="flex items-center gap-2 text-sm text-orange-500"><Download size={16} />{text("دانلود CSV", "Download CSV", "CSV herunterladen", "CSV indir")}</a>}</div>
    <p className="text-sm text-[var(--text-secondary)]">{text("نتایج بررسی‌های موفق ذخیره می‌شوند. کشور، زبان و دستگاه جداگانه نمایش داده می‌شوند؛ نبودن در ۱۰ نتیجه اول، رتبه صفر نیست.", "Successful checks are saved by country, language and device. Absence from the first 10 results is not position zero.", "Erfolgreiche Prüfungen werden nach Land, Sprache und Gerät gespeichert. Außerhalb der ersten 10 Ergebnisse bedeutet nicht Rang null.", "Başarılı kontroller ülke, dil ve cihaz bazında saklanır. İlk 10 sonuçta bulunmamak sıfırıncı sıra değildir.")}</p>
    {loading ? <p role="status">{text("در حال بارگذاری…", "Loading…", "Wird geladen…", "Yükleniyor…")}</p> : failed ? <p role="alert">{text("تاریخچه در دسترس نیست؛ دوباره صفحه را باز کنید.", "History is unavailable. Reopen the page to retry.", "Verlauf nicht verfügbar. Seite erneut öffnen.", "Geçmiş kullanılamıyor. Sayfayı yeniden açın.")}</p> : !rows.length ? <p className="text-sm text-[var(--text-secondary)]">{text("با ابزار «رتبه زنده» اولین بررسی را اجرا کنید؛ نتیجه پس از تکمیل اینجا می‌ماند.", "Run your first Live rank check. The completed observation will remain here.", "Führen Sie eine Live-Rangprüfung durch. Das Ergebnis bleibt hier gespeichert.", "İlk canlı sıralama kontrolünü çalıştırın. Tamamlanan gözlem burada saklanır.")}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[text("کلمه کلیدی", "Keyword", "Keyword", "Anahtar kelime"), text("بازار و دستگاه", "Market & device", "Markt & Gerät", "Pazar ve cihaz"), text("رتبه مشاهده‌شده", "Observed position", "Beobachteter Rang", "Gözlemlenen sıra"), text("تاریخ بررسی", "Checked at", "Prüfdatum", "Kontrol tarihi")].map(label => <th className="p-3 text-start whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-[var(--border)]"><td className="p-3 min-w-32">{row.keyword}</td><td className="p-3 whitespace-nowrap">{row.locationCode} · {row.languageCode} · {row.device === "mobile" ? text("موبایل", "Mobile", "Mobil", "Mobil") : text("کامپیوتر", "Desktop", "Desktop", "Masaüstü")}</td><td className="p-3">{row.position === null ? text("در ۱۰ نتیجه مشاهده نشد", "Not observed in top 10", "Nicht in Top 10 beobachtet", "İlk 10'da gözlemlenmedi") : row.position.toLocaleString(lang)}</td><td className="p-3 whitespace-nowrap">{new Date(row.checkedAt).toLocaleString(lang)}</td></tr>)}</tbody></table></div>}
  </section>;
}
