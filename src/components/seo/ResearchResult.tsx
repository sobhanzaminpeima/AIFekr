"use client";
import { useTranslation, tri } from "@/lib/i18n";
type Item = Record<string, unknown>;
export default function ResearchResult({ action, result }: { action: string; result: string }) {
  const { lang } = useTranslation();
  const text = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  let data: unknown; try { data = JSON.parse(result); } catch { return null; }
  const metric = (value: unknown) => typeof value === "number" ? value.toLocaleString(lang, { maximumFractionDigits: 2 }) : typeof value === "string" ? value : "—";
  const noData = <p className="mt-4 text-sm text-[var(--text-secondary)]">{text("سرویس برای این بررسی داده‌ای برنگرداند. این به معنی مقدار صفر یا نبودن سایت در تمام نتایج نیست.", "The provider returned no data for this check. This does not mean zero activity or absence from all results.", "Der Anbieter hat keine Daten geliefert. Das bedeutet weder null Aktivität noch Abwesenheit in allen Ergebnissen.", "Sağlayıcı bu kontrol için veri döndürmedi. Bu, sıfır etkinlik veya tüm sonuçlarda yokluk anlamına gelmez.")}</p>;
  if (action === "keywordGap") {
    const rows = Array.isArray(data) ? data as Item[] : [];
    return <ResearchResult action="keywords" result={JSON.stringify(rows.map(row => row.keyword_data))} />;
  }
  if (action === "aiVisibility") {
    const rows = Array.isArray(data) ? data as Item[] : [];
    if (!rows.length) return noData;
    return <div className="mt-4 space-y-3"><p className="text-xs text-[var(--text-secondary)]">{text("شواهد نمونه‌برداری‌شده؛ نبود نتیجه به معنی نبود حضور در همه پاسخ‌ها نیست.", "Sampled evidence; missing results do not mean absence from every answer.", "Stichproben; fehlende Ergebnisse bedeuten keine generelle Abwesenheit.", "Örneklenen kanıtlar; sonuç yokluğu tüm yanıtlarda yokluk anlamına gelmez.")}</p>{rows.map((row, index) => <article key={index} className="rounded-xl bg-[var(--surface-1)] p-4"><h3 className="text-sm font-semibold">{metric(row.question)}</h3><p className="mt-3 text-sm whitespace-pre-wrap leading-7">{metric(row.answer)}</p><p className="mt-3 text-xs text-[var(--text-secondary)]">{metric(row.last_response_at)}</p></article>)}</div>;
  }
  if (action === "backlinkHistory") {
    const rows = Array.isArray(data) ? data as Item[] : [];
    if (!rows.length) return noData;
    return <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[text("تاریخ", "Date", "Datum", "Tarih"), text("بک‌لینک", "Backlinks", "Backlinks", "Geri bağlantılar"), text("دامنه‌ها", "Domains", "Domains", "Alan adları")].map(label => <th key={label} className="p-3 text-start">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-[var(--border)]"><td className="p-3">{metric(row.date)}</td><td className="p-3">{metric(row.backlinks)}</td><td className="p-3">{metric(row.referring_domains)}</td></tr>)}</tbody></table></div>;
  }
  const columns = action === "keywords" ? [text("کلمه", "Keyword", "Keyword", "Kelime"), text("جست‌وجوی ماهانه", "Monthly searches", "Monatliche Suchen", "Aylık aramalar"), "CPC (USD)", text("سختی", "Difficulty", "Schwierigkeit", "Zorluk"), text("هدف جست‌وجو", "Intent", "Suchabsicht", "Arama amacı")] : action === "rank" ? [text("رتبه", "Position", "Position", "Konum"), text("دامنه", "Domain", "Domain", "Alan adı"), text("عنوان", "Title", "Titel", "Başlık")] : action === "competitors" ? [text("دامنه", "Domain", "Domain", "Alan adı"), text("کلمات مشترک", "Shared keywords", "Gemeinsame Keywords", "Ortak kelimeler"), text("میانگین رتبه", "Average position", "Durchschnittsposition", "Ortalama konum")] : [text("دامنه", "Domain", "Domain", "Alan adı"), text("بک‌لینک", "Backlinks", "Backlinks", "Geri bağlantılar"), text("رتبه سرویس", "Provider rank", "Anbieter-Rang", "Sağlayıcı puanı"), text("امتیاز اسپم", "Spam score", "Spam-Score", "Spam puanı")];
  if (action === "backlinks") {
    const values = data as Item;
    const labels = { backlinks: text("بک‌لینک‌ها", "Backlinks", "Backlinks", "Geri bağlantılar"), referring_domains: text("دامنه‌های ارجاع‌دهنده", "Referring domains", "Verweisende Domains", "Yönlendiren alan adları"), referring_pages: text("صفحات ارجاع‌دهنده", "Referring pages", "Verweisende Seiten", "Yönlendiren sayfalar"), broken_backlinks: text("لینک‌های خراب", "Broken backlinks", "Defekte Backlinks", "Bozuk bağlantılar") };
    return <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-xl bg-[var(--surface-1)] p-4"><p className="text-xs text-[var(--text-secondary)]">{label}</p><strong className="block mt-2 text-2xl">{metric(values[key])}</strong></div>)}</div>;
  }
  const items = Array.isArray(data) ? data.filter(v => v && typeof v === "object") as Item[] : [];
  const rows = action === "rank" ? items.filter(item => item.type === "organic") : items;
  if (!rows.length) return noData;
  function cells(item: Item): unknown[] {
    if (action === "keywords") { const info = item.keyword_info as Item | null; const properties = item.keyword_properties as Item | null; const intent = item.search_intent_info as Item | null; return [item.keyword, info?.search_volume, info?.cpc, properties?.keyword_difficulty, intent?.main_intent]; }
    if (action === "rank") return [item.rank_absolute, item.domain, item.title];
    if (action === "competitors") return [item.domain, item.intersections, item.avg_position];
    return [item.domain, item.backlinks, item.rank, item.backlinks_spam_score];
  }
  return <div className="mt-4"><p className="mb-3 text-xs text-[var(--text-secondary)]">{text("منبع: DataForSEO · مقادیر نامشخص با — نمایش داده می‌شوند.", "Source: DataForSEO · Unavailable values appear as —.", "Quelle: DataForSEO · Nicht verfügbare Werte werden als — angezeigt.", "Kaynak: DataForSEO · Kullanılamayan değerler — olarak gösterilir.")}</p><div className="overflow-x-auto"><table className="w-full text-sm text-start"><thead><tr>{columns.map(column => <th key={column} className="p-3 text-start whitespace-nowrap font-medium text-[var(--text-secondary)]">{column}</th>)}</tr></thead><tbody>{rows.map((item, index) => <tr key={index} className="border-t border-[var(--border)]">{cells(item).map((cell, i) => <td key={i} className="p-3 min-w-24 max-w-xs break-words">{metric(cell)}</td>)}</tr>)}</tbody></table></div></div>;
}

