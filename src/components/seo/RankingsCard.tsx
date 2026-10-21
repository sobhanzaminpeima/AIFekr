"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, RefreshCw, ArrowUp, ArrowDown, Minus, LineChart as LineChartIcon } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";

interface Row { query: string; clicks: number; impressions: number; ctr: number; position: number; moved: number | null; isNew: boolean }
interface Opp { query: string; kind: "striking_distance" | "low_ctr"; position: number; ctr: number; potentialExtraClicks: number }
interface View {
  connected: boolean; latestDate: string | null; previousDate: string | null;
  comparison: { rows: Row[]; gained: number; lost: number; newQueries: number; dropped: { query: string }[] } | null;
  opportunities: Opp[];
}

/** Real Search Console rankings for a tracked site. Nothing here is estimated: no data means an explanation, never made-up numbers. */
export default function RankingsCard({ siteId }: { siteId: string }) {
  const { lang } = useTranslation();
  const [view, setView] = useState<View | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/seo/sites/${siteId}/rankings`, { credentials: "include" });
    if (r.ok) setView(await r.json());
  }, [siteId]);
  useEffect(() => { setView(null); setProblem(null); load(); }, [siteId, load]);

  async function sync() {
    setSyncing(true);
    setProblem(null);
    try {
      const r = await fetch(`/api/seo/sites/${siteId}/rankings`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) { setProblem(d.error); return; }
      setView(d);
      toast.success(tri(lang, "داده‌های Search Console به‌روز شد", "Search Console data updated", "Search-Console-Daten aktualisiert"));
    } catch {
      setProblem(tri(lang, "خطا در ارتباط با سرور", "Could not reach the server", "Server nicht erreichbar"));
    } finally {
      setSyncing(false);
    }
  }

  const Move = ({ r }: { r: Row }) => {
    if (r.isNew) return <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>{tri(lang, "جدید", "new", "neu")}</span>;
    if (r.moved == null || Math.abs(r.moved) < 0.5) return <Minus className="w-3 h-3" style={{ color: "var(--text-muted)" }} />;
    return r.moved > 0
      ? <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "#22c55e" }}><ArrowUp className="w-3 h-3" />{r.moved}</span>
      : <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "#ef4444" }}><ArrowDown className="w-3 h-3" />{Math.abs(r.moved)}</span>;
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "رتبه‌ها در گوگل (داده واقعی Search Console)", "Google rankings (real Search Console data)", "Google-Rankings (echte Search-Console-Daten)")}</span>
        </div>
        {view?.connected && (
          <button onClick={sync} disabled={syncing} className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{tri(lang, "به‌روزرسانی", "Refresh", "Aktualisieren")}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!view ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /></div>
        ) : !view.connected ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "برای دیدن رتبه واقعی کلمات کلیدی و تغییرات هفتگی، Google Search Console را وصل کنید. ", "Connect Google Search Console to see your real keyword rankings and weekly changes. ", "Verbinden Sie die Google Search Console, um Ihre echten Keyword-Rankings und wöchentlichen Änderungen zu sehen. ")}
            <Link href="/seo" className="underline" style={{ color: "var(--primary)" }}>{tri(lang, "اتصال", "Connect", "Verbinden")}</Link>
          </p>
        ) : (
          <>
            {problem && <p className="text-xs p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{problem}</p>}
            {!view.comparison ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز داده‌ای دریافت نشده. «به‌روزرسانی» را بزنید؛ از این پس هفته‌ای یک‌بار خودکار ذخیره می‌شود.", "No data yet. Click “Refresh”; from now on it's saved automatically once a week.", "Noch keine Daten. Klicken Sie auf „Aktualisieren“; danach wird wöchentlich automatisch gespeichert.")}</p>
            ) : (
              <>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, `۷ روز منتهی به ${view.latestDate}`, `7 days ending ${view.latestDate}`, `7 Tage bis ${view.latestDate}`)}
                  {view.previousDate ? ` · ${tri(lang, `مقایسه با ${view.previousDate}`, `compared with ${view.previousDate}`, `verglichen mit ${view.previousDate}`)}` : ` · ${tri(lang, "اولین ثبت؛ از هفته بعد تغییرات نمایش داده می‌شود", "first snapshot — changes appear from next week", "erster Snapshot – Änderungen ab nächster Woche")}`}
                </p>
                {view.previousDate && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span style={{ color: "#22c55e" }}>▲ {view.comparison.gained} {tri(lang, "بهبود یافته", "improved", "verbessert")}</span>
                    <span style={{ color: "#ef4444" }}>▼ {view.comparison.lost} {tri(lang, "افت کرده", "dropped", "verschlechtert")}</span>
                    <span style={{ color: "#3b82f6" }}>★ {view.comparison.newQueries} {tri(lang, "عبارت جدید", "new queries", "neue Suchanfragen")}</span>
                  </div>
                )}
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                    <span>{tri(lang, "عبارت جستجو", "Query", "Suchanfrage")}</span><span>{tri(lang, "رتبه", "Pos.", "Pos.")}</span><span>{tri(lang, "تغییر", "Change", "Änd.")}</span><span>{tri(lang, "کلیک", "Clicks", "Klicks")}</span>
                  </div>
                  {view.comparison.rows.slice(0, 20).map((r) => (
                    <div key={r.query} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-xs items-center" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <span className="truncate">{r.query}</span>
                      <span className="tabular-nums">{r.position.toFixed(1)}</span>
                      <Move r={r} />
                      <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>{r.clicks}</span>
                    </div>
                  ))}
                </div>

                {view.opportunities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{tri(lang, "فرصت‌های رشد", "Growth opportunities", "Wachstumschancen")}</p>
                    <ul className="space-y-1">
                      {view.opportunities.slice(0, 6).map((o) => (
                        <li key={o.query} className="text-xs flex items-center justify-between gap-2" style={{ color: "var(--text-secondary)" }}>
                          <span className="truncate">{o.query}</span>
                          <span className="flex-shrink-0 opacity-80">
                            {o.kind === "striking_distance" ? tri(lang, `رتبه ${o.position.toFixed(1)} — نزدیک به ۳ برتر`, `pos ${o.position.toFixed(1)} — near the top 3`, `Pos. ${o.position.toFixed(1)} — nahe den Top 3`) : tri(lang, `CTR پایین (${o.ctr.toFixed(1)}٪) — عنوان/توضیحات را بازنویسی کنید`, `low CTR (${o.ctr.toFixed(1)}%) — rewrite title/description`, `niedrige CTR (${o.ctr.toFixed(1)} %) — Titel/Beschreibung überarbeiten`)} · +{o.potentialExtraClicks}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "کلیک اضافه برآورد است (از نمایش واقعی و CTR متوسط صنعت)، نه تضمین.", "Extra clicks are an estimate from your real impressions and typical CTR — not a promise.", "Mehrklicks sind eine Schätzung aus Ihren echten Impressionen und dem üblichen CTR – keine Zusage.")}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
