"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, PenLine, Play, ExternalLink, AlertTriangle } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import CreditCost from "@/components/ui/CreditCost";

interface RunRow { id: string; topic: string; status: string; createdAt: string; post: { id: string; title: string; externalStatus: string; externalUrl: string | null; externalError: string | null } | null }
interface PlanState { enabled: boolean; theme: string; topics: string[]; brandVoice: string; frequency: string; mode: string; nextRunAt: string | null; lastRunAt: string | null; lastError: string | null; running: boolean }

/** Blog automation for one tracked site: what to write about, how often, and whether posts go live, to drafts, or stay in AiFekr. */
export default function ContentPlanCard({ siteId }: { siteId: string }) {
  const { lang } = useTranslation();
  const locale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—");

  const [plan, setPlan] = useState<PlanState | null>(null);
  const [topicsText, setTopicsText] = useState("");
  const [wp, setWp] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const dirty = useRef(false);
  const [writeTopic, setWriteTopic] = useState("");
  const [writeMode, setWriteMode] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/seo/sites/${siteId}/content-plan`, { credentials: "include" });
    const d = await r.json();
    if (!r.ok) return;
    setPlan((cur) => (dirty.current && cur ? { ...cur, running: d.plan.running, lastError: d.plan.lastError, lastRunAt: d.plan.lastRunAt, nextRunAt: d.plan.nextRunAt } : d.plan));
    if (!dirty.current) setTopicsText(d.plan.topics.join("\n"));
    setWp(d.wordpressConnected);
    setRuns(d.runs);
  }, [siteId]);

  useEffect(() => { dirty.current = false; setPlan(null); load(); }, [siteId, load]);
  // While a post is being written, keep looking for the result.
  useEffect(() => {
    if (!plan?.running && !starting) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [plan?.running, starting, load]);

  const edit = (patch: Partial<PlanState>) => { dirty.current = true; setPlan((p) => (p ? { ...p, ...patch } : p)); };

  async function save(overrides: Partial<PlanState> = {}) {
    if (!plan) return;
    setSaving(true);
    try {
      const body = { ...plan, ...overrides, topics: topicsText };
      const r = await fetch(`/api/seo/sites/${siteId}/content-plan`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      dirty.current = false;
      await load();
      toast.success(tri(lang, "برنامه ذخیره شد", "Plan saved", "Plan gespeichert"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setStarting(true);
    try {
      if (dirty.current) await save();
      const r = await fetch(`/api/seo/sites/${siteId}/content-plan/run`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(tri(lang, "نوشتن مقاله شروع شد؛ چند دقیقه طول می‌کشد.", "Writing started — it takes a few minutes.", "Der Beitrag wird geschrieben – das dauert einige Minuten."));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  async function writeNow() {
    if (writeTopic.trim().length < 5) { toast.error(tri(lang, "موضوع مقاله را بنویسید.", "Enter the article topic.", "Geben Sie das Artikelthema ein.")); return; }
    setStarting(true);
    try {
      const r = await fetch(`/api/seo/sites/${siteId}/content-plan/write`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: writeTopic, mode: writeMode || plan?.mode }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(tri(lang, "نوشتن مقاله شروع شد؛ چند دقیقه طول می‌کشد.", "Writing started — it takes a few minutes.", "Der Beitrag wird geschrieben – das dauert einige Minuten."));
      setWriteTopic("");
      setTimeout(load, 1500); // the run marks itself "running" a moment after the request returns
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  if (!plan) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /></div>;

  const errorText: Record<string, string> = {
    insufficient_credits: tri(lang, "اعتبار کافی برای نوشتن مقاله نبود؛ فردا دوباره تلاش می‌شود.", "Not enough credits to write a post; it will retry tomorrow.", "Nicht genug Credits für einen Beitrag; morgen erfolgt ein neuer Versuch."),
    no_topic: tri(lang, "موضوعی برای نوشتن نیست؛ موضوع یا تم اضافه کنید.", "Nothing to write about; add a topic or a theme.", "Kein Thema vorhanden; fügen Sie ein Thema oder Oberthema hinzu."),
  };
  const modes = [
    { v: "draft", label: tri(lang, "پیش‌نویس در وردپرس (پیشنهادی)", "WordPress draft (recommended)", "WordPress-Entwurf (empfohlen)"), needsWp: true },
    { v: "publish", label: tri(lang, "انتشار مستقیم در وردپرس", "Publish live to WordPress", "Direkt auf WordPress veröffentlichen"), needsWp: true },
    { v: "hold", label: tri(lang, "فقط ذخیره در AiFekr", "Keep in AiFekr only", "Nur in AiFekr speichern"), needsWp: false },
  ];
  const freqs = [
    { v: "daily", label: tri(lang, "روزانه", "Daily", "Täglich") }, { v: "every3days", label: tri(lang, "هر ۳ روز", "Every 3 days", "Alle 3 Tage") },
    { v: "weekly", label: tri(lang, "هفتگی", "Weekly", "Wöchentlich") }, { v: "biweekly", label: tri(lang, "هر ۲ هفته", "Every 2 weeks", "Alle 2 Wochen") },
  ];
  const input = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;
  const needsWpWarning = !wp && plan.mode !== "hold";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "اتوماسیون بلاگ", "Blog automation", "Blog-Automatisierung")}</span>
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={plan.enabled} disabled={saving} onChange={(e) => { edit({ enabled: e.target.checked }); save({ enabled: e.target.checked }); }} />
          {plan.enabled ? tri(lang, "فعال", "On", "An") : tri(lang, "خاموش", "Off", "Aus")}
        </label>
      </div>

      <div className="p-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "همین حالا یک مقاله با موضوع دلخواه بنویس", "Write an article on a topic of your choice, now", "Jetzt einen Artikel zu einem Thema Ihrer Wahl schreiben")}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={writeTopic} onChange={(e) => setWriteTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") writeNow(); }} placeholder={tri(lang, "مثلاً: راهنمای خرید آپارتمان در برلین", "e.g. A guide to buying a flat in Berlin", "z. B. Ratgeber: Wohnung in Berlin kaufen")} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={writeMode || plan.mode} onChange={(e) => setWriteMode(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {modes.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
          <button onClick={writeNow} disabled={starting || plan.running} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: "var(--primary)" }}>
            {starting || plan.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}{tri(lang, "بنویس و ارسال کن", "Write & send", "Schreiben & senden")} <CreditCost feature="seo.pipeline" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "AiFekr طبق برنامه، با تیم ۸ عاملی محتوا مقاله می‌نویسد. هر مقاله به اندازه یک اجرای خط تولید محتوا اعتبار مصرف می‌کند.", "On schedule, AiFekr writes a post with its 8-agent content team. Each post costs one content-pipeline run.", "AiFekr schreibt planmäßig einen Beitrag mit dem 8-Agenten-Content-Team. Jeder Beitrag kostet einen Pipeline-Lauf.")} <CreditCost feature="seo.pipeline" /></p>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تم کلی بلاگ (وقتی صف موضوع‌ها خالی شد)", "Blog theme (used when the topic queue is empty)", "Blog-Thema (wenn die Themenliste leer ist)")}</label>
          <input value={plan.theme} onChange={(e) => edit({ theme: e.target.value })} placeholder={tri(lang, "مثلاً: املاک و مستغلات در برلین", "e.g. Real estate in Berlin", "z. B. Immobilien in Berlin")} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={input} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "صف موضوع‌ها (هر خط یک مقاله، به ترتیب)", "Topic queue (one per line, written in order)", "Themenliste (eine pro Zeile, der Reihe nach)")}</label>
          <textarea value={topicsText} onChange={(e) => { dirty.current = true; setTopicsText(e.target.value); }} rows={4} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y" style={input} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تناوب انتشار", "How often", "Häufigkeit")}</label>
            <select value={plan.frequency} onChange={(e) => edit({ frequency: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={input}>{freqs.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "مقصد انتشار", "What happens to a finished post", "Was mit dem fertigen Beitrag passiert")}</label>
            <select value={plan.mode} onChange={(e) => edit({ mode: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={input}>{modes.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select>
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "لحن برند (اختیاری)", "Brand voice (optional)", "Markenstimme (optional)")}</label>
          <input value={plan.brandVoice} onChange={(e) => edit({ brandVoice: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={input} />
        </div>

        {needsWpWarning && (
          <p className="flex items-start gap-2 text-xs p-3 rounded-xl" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {tri(lang, "وردپرس وصل نیست، پس مقاله‌ها فقط در AiFekr ذخیره می‌شوند. برای انتشار، وردپرس را در صفحه ابزارهای سئو وصل کنید.", "WordPress isn't connected, so posts stay in AiFekr only. Connect it on the SEO tools page to publish.", "WordPress ist nicht verbunden, daher bleiben Beiträge nur in AiFekr. Verbinden Sie es auf der SEO-Tools-Seite zum Veröffentlichen.")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => save()} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{tri(lang, "ذخیره برنامه", "Save plan", "Plan speichern")}
          </button>
          <button onClick={runNow} disabled={plan.running || starting} className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--surface-2)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
            {plan.running || starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {plan.running || starting ? tri(lang, "در حال نوشتن...", "Writing...", "Schreibt...") : tri(lang, "همین حالا یک مقاله بنویس", "Write one now", "Jetzt einen Beitrag schreiben")}
          </button>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {plan.enabled && plan.nextRunAt ? `${tri(lang, "مقاله بعدی", "Next post", "Nächster Beitrag")}: ${fmt(plan.nextRunAt)}` : ""}
            {plan.lastRunAt ? ` · ${tri(lang, "آخرین", "last", "zuletzt")}: ${fmt(plan.lastRunAt)}` : ""}
          </span>
        </div>

        {plan.lastError && (
          <p className="text-xs p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{errorText[plan.lastError] ?? plan.lastError}</p>
        )}

        {runs.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "مقاله‌های تولیدشده", "Generated posts", "Erstellte Beiträge")}</p>
            <div className="space-y-1.5">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  <span className="flex-1 min-w-0 truncate">{r.post?.title || r.topic}</span>
                  <span className="flex-shrink-0 opacity-70">
                    {r.status === "running" ? tri(lang, "در حال نوشتن", "writing", "schreibt") : r.status === "failed" ? tri(lang, "ناموفق", "failed", "fehlgeschlagen")
                      : r.post?.externalStatus === "published" ? tri(lang, "منتشر شد", "published", "veröffentlicht")
                      : r.post?.externalStatus === "draft" ? tri(lang, "پیش‌نویس در وردپرس", "WordPress draft", "WordPress-Entwurf")
                      : r.post?.externalStatus === "failed" ? tri(lang, "خطا در انتشار", "publish failed", "Veröffentlichung fehlgeschlagen")
                      : r.post?.externalStatus === "held_for_review" ? tri(lang, "منتظر بازبینی", "held for review", "zur Prüfung zurückgehalten")
                      : tri(lang, "ذخیره در AiFekr", "saved in AiFekr", "in AiFekr gespeichert")}
                  </span>
                  {r.post?.externalUrl && <a href={r.post.externalUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0" style={{ color: "var(--primary)" }}><ExternalLink className="w-3.5 h-3.5" /></a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
