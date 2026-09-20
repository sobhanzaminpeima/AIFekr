"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Globe, Plus, Loader2, RefreshCw, Trash2, Sparkles, ChevronDown, ArrowLeft, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation, tri } from "@/lib/i18n";
import CreditCost from "@/components/ui/CreditCost";
import SeoPlanCard, { type PlanView } from "@/components/seo/SeoPlanCard";
import ContentPlanCard from "@/components/seo/ContentPlanCard";
import RankingsCard from "@/components/seo/RankingsCard";
import { GSC_ENABLED } from "@/lib/seo/features";

interface Site { id: string; url: string; name: string | null; autoAudit: boolean; frequency: string; lastAuditAt: string | null; nextAuditAt: string | null; lastScore: number | null }
interface AuditRow { id: string; score: number; pagesCrawled: number; failCount: number; warnCount: number; passCount: number; source: string; createdAt: string }
interface Issue { id: string; label: string; status: "warning" | "fail"; detail: string }
interface PageRow { url: string; score: number; statusCode: number; title: string; issues: Issue[] }
interface IssueRef { scope: string; id: string; label: string; status: "warning" | "fail" }
interface Diff { scoreDelta: number; fixed: IssueRef[]; added: IssueRef[]; remaining: number }
interface AuditFull { audit: AuditRow & { planCreatedAt: string | null }; pages: PageRow[]; siteIssues: Issue[]; diff: Diff | null; plan: PlanView | null }

const scoreColor = (s: number) => (s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : "#ef4444");

export default function SeoSitesPage() {
  const { lang } = useTranslation();
  const locale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—");

  const [sites, setSites] = useState<Site[]>([]);
  const [limit, setLimit] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [detail, setDetail] = useState<AuditFull | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [improving, setImproving] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const selected = sites.find((s) => s.id === selectedId) ?? null;

  const loadSites = useCallback(async (keepSelection = true) => {
    try {
      const r = await fetch("/api/seo/sites", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSites(d.sites);
      setLimit(d.limit);
      setSelectedId((cur) => (keepSelection && cur && d.sites.some((s: Site) => s.id === cur) ? cur : d.sites[0]?.id ?? null));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async (auditId: string) => {
    const r = await fetch(`/api/seo/audits/${auditId}`, { credentials: "include" });
    const d = await r.json();
    if (r.ok) { setDetail(d); setOpen(new Set()); }
  }, []);

  const loadHistory = useCallback(async (siteId: string) => {
    const r = await fetch(`/api/seo/sites/${siteId}/audits`, { credentials: "include" });
    const d = await r.json();
    if (!r.ok) return;
    setHistory(d.audits);
    if (d.audits[0]) await loadAudit(d.audits[0].id); else setDetail(null);
  }, [loadAudit]);

  useEffect(() => { loadSites(false); }, [loadSites]);
  useEffect(() => { setDetail(null); setHistory([]); if (selectedId) loadHistory(selectedId); }, [selectedId, loadHistory]);

  async function addSite() {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/seo/sites", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: newUrl }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNewUrl("");
      await loadSites();
      setSelectedId(d.site.id);
      toast.success(tri(lang, "وب‌سایت اضافه شد. اولین تحلیل را اجرا کنید.", "Website added. Run its first audit.", "Website hinzugefügt. Starten Sie die erste Analyse."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  async function runAudit() {
    if (!selected) return;
    setRunning(true);
    try {
      const r = await fetch(`/api/seo/sites/${selected.id}/audit`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await Promise.all([loadSites(), loadHistory(selected.id)]);
      toast.success(tri(lang, "تحلیل انجام و ذخیره شد", "Audit finished and saved", "Analyse abgeschlossen und gespeichert"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  async function patchSite(patch: Partial<Pick<Site, "autoAudit" | "frequency">>) {
    if (!selected) return;
    const r = await fetch(`/api/seo/sites/${selected.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) await loadSites(); else toast.error((await r.json()).error || "Error");
  }

  async function removeSite() {
    if (!selected) return;
    if (!confirm(tri(lang, "این وب‌سایت و تمام تاریخچه تحلیل‌هایش حذف شود؟", "Delete this website and its whole audit history?", "Diese Website und den gesamten Verlauf löschen?"))) return;
    const r = await fetch(`/api/seo/sites/${selected.id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { setSelectedId(null); await loadSites(false); } else toast.error("Error");
  }

  async function improve() {
    if (!detail) return;
    setImproving(true);
    try {
      const r = await fetch(`/api/seo/audits/${detail.audit.id}/improve`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDetail({ ...detail, plan: d.plan, audit: { ...detail.audit, planCreatedAt: new Date().toISOString() } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setImproving(false);
    }
  }

  const toggle = (url: string) => setOpen((cur) => { const n = new Set(cur); if (n.has(url)) n.delete(url); else n.add(url); return n; });
  const chart = [...history].reverse().map((a) => ({ date: new Date(a.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" }), score: a.score }));
  const freqLabel: Record<string, string> = { daily: tri(lang, "روزانه", "Daily", "Täglich"), weekly: tri(lang, "هفتگی", "Weekly", "Wöchentlich"), monthly: tri(lang, "ماهانه", "Monthly", "Monatlich") };
  const StatusIcon = ({ s }: { s: "warning" | "fail" }) => (s === "fail" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ef4444" }} /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#eab308" }} />);

  return (
    <div className="flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "مانیتور سئو", "SEO Monitor", "SEO-Monitor")}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "وب‌سایتتان را اضافه کنید؛ AiFekr آن را تحلیل می‌کند، نتیجه را ذخیره می‌کند و به‌صورت خودکار دوباره می‌سنجد.", "Add your website: AiFekr audits it, saves the results and re-checks it automatically.", "Fügen Sie Ihre Website hinzu: AiFekr analysiert sie, speichert die Ergebnisse und prüft automatisch erneut.")}</p>
        </div>
        <Link href="/seo" className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" />{tri(lang, "ابزارهای سئو", "SEO tools", "SEO-Tools")}
        </Link>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSite(); }} dir="ltr" placeholder="mysite.com"
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={addSite} disabled={adding || !newUrl.trim() || sites.length >= limit} className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{tri(lang, "افزودن وب‌سایت", "Add website", "Website hinzufügen")}
          </button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{tri(lang, `${sites.length} از ${limit} وب‌سایت مجاز پلن شما`, `${sites.length} of ${limit} websites on your plan`, `${sites.length} von ${limit} Websites in Ihrem Tarif`)}</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /></div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <Globe className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز وب‌سایتی اضافه نکرده‌اید. آدرس سایتتان را بالا بنویسید.", "You haven't added a website yet. Type your address above.", "Sie haben noch keine Website hinzugefügt. Geben Sie oben Ihre Adresse ein.")}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sites.map((s) => (
              <button key={s.id} onClick={() => setSelectedId(s.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-shrink-0"
                style={{ background: s.id === selectedId ? "var(--primary)" : "var(--surface-1)", color: s.id === selectedId ? "#fff" : "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Globe className="w-3.5 h-3.5" /><span dir="ltr">{s.name || s.url}</span>
                {s.lastScore != null && <span className="text-xs font-bold px-1.5 rounded-md" style={{ background: "rgba(0,0,0,0.25)", color: s.id === selectedId ? "#fff" : scoreColor(s.lastScore) }}>{s.lastScore}</span>}
              </button>
            ))}
          </div>

          {selected && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" dir="ltr" style={{ color: "var(--text-primary)" }}>{selected.url}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {tri(lang, "آخرین تحلیل", "Last audit", "Letzte Analyse")}: {fmt(selected.lastAuditAt)}
                    {selected.autoAudit && selected.nextAuditAt ? ` · ${tri(lang, "بعدی", "next", "nächste")}: ${fmt(selected.nextAuditAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={selected.autoAudit} onChange={(e) => patchSite({ autoAudit: e.target.checked })} />
                    {tri(lang, "تحلیل خودکار", "Auto re-audit", "Automatisch prüfen")}
                  </label>
                  {selected.autoAudit && (
                    <select value={selected.frequency} onChange={(e) => patchSite({ frequency: e.target.value })} className="text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {Object.entries(freqLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                  <button onClick={runAudit} disabled={running} className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
                    {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{running ? tri(lang, "در حال تحلیل...", "Auditing...", "Analysiere...") : tri(lang, "تحلیل مجدد", "Run audit", "Analyse starten")}
                  </button>
                  <button onClick={removeSite} title={tri(lang, "حذف", "Delete", "Löschen")} className="p-2 rounded-xl" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {!detail ? (
                <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>{running ? tri(lang, "در حال خزش صفحه‌ها...", "Crawling your pages...", "Seiten werden analysiert...") : tri(lang, "هنوز تحلیلی انجام نشده. «تحلیل مجدد» را بزنید.", "No audit yet. Click “Run audit”.", "Noch keine Analyse. Klicken Sie auf „Analyse starten“.")}</div>
              ) : (
                <div className="p-4 space-y-5">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold" style={{ color: scoreColor(detail.audit.score) }}>{detail.audit.score}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>/ 100</div>
                    </div>
                    <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <div>{tri(lang, `${detail.audit.pagesCrawled} صفحه بررسی شد`, `${detail.audit.pagesCrawled} pages audited`, `${detail.audit.pagesCrawled} Seiten geprüft`)} · {fmt(detail.audit.createdAt)} · {detail.audit.source === "auto" ? tri(lang, "خودکار", "scheduled", "geplant") : tri(lang, "دستی", "manual", "manuell")}</div>
                      <div><span style={{ color: "#ef4444" }}>{detail.audit.failCount} {tri(lang, "خطا", "failing", "Fehler")}</span> · <span style={{ color: "#eab308" }}>{detail.audit.warnCount} {tri(lang, "هشدار", "warnings", "Warnungen")}</span> · <span style={{ color: "#22c55e" }}>{detail.audit.passCount} {tri(lang, "سالم", "passing", "in Ordnung")}</span></div>
                      {detail.diff && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="flex items-center gap-1 font-semibold" style={{ color: detail.diff.scoreDelta >= 0 ? "#22c55e" : "#ef4444" }}>
                            {detail.diff.scoreDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{detail.diff.scoreDelta > 0 ? "+" : ""}{detail.diff.scoreDelta}
                          </span>
                          <span className="flex items-center gap-1" style={{ color: "#22c55e" }}><CheckCircle2 className="w-3.5 h-3.5" />{tri(lang, `${detail.diff.fixed.length} مورد رفع شد`, `${detail.diff.fixed.length} fixed`, `${detail.diff.fixed.length} behoben`)}</span>
                          <span className="flex items-center gap-1" style={{ color: detail.diff.added.length ? "#ef4444" : "var(--text-muted)" }}><AlertTriangle className="w-3.5 h-3.5" />{tri(lang, `${detail.diff.added.length} مشکل جدید`, `${detail.diff.added.length} new`, `${detail.diff.added.length} neu`)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {chart.length >= 2 && (
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12 }} />
                          <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {detail.diff && (detail.diff.added.length > 0 || detail.diff.fixed.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[{ list: detail.diff.added, title: tri(lang, "مشکلات جدید", "New issues", "Neue Probleme"), color: "#ef4444" }, { list: detail.diff.fixed, title: tri(lang, "رفع‌شده از تحلیل قبلی", "Fixed since last audit", "Seit der letzten Analyse behoben"), color: "#22c55e" }].filter((b) => b.list.length).map((b) => (
                        <div key={b.title} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                          <p className="text-xs font-semibold mb-1.5" style={{ color: b.color }}>{b.title}</p>
                          <ul className="space-y-1">
                            {b.list.slice(0, 8).map((i, k) => (<li key={k} className="text-xs" style={{ color: "var(--text-secondary)" }}>{i.label}{i.scope !== "site" && <span dir="ltr" className="opacity-60"> — {i.scope.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>}</li>))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <button onClick={improve} disabled={improving} className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,var(--primary),#8b5cf6)" }}>
                      {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {improving ? tri(lang, "در حال تهیه برنامه بهبود...", "Building your improvement plan...", "Verbesserungsplan wird erstellt...") : detail.plan ? tri(lang, "تهیه دوباره برنامه بهبود با هوش مصنوعی", "Regenerate AI improvement plan", "KI-Verbesserungsplan neu erstellen") : tri(lang, "بهبود با هوش مصنوعی", "Improve with AI", "Mit KI verbessern")} <CreditCost feature="seo.improve" />
                    </button>
                    {detail.plan && <SeoPlanCard plan={detail.plan} />}
                  </div>

                  {detail.siteIssues.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{tri(lang, "مشکلات کل سایت", "Site-wide issues", "Website-weite Probleme")}</p>
                      <ul className="space-y-1.5">{detail.siteIssues.map((i) => (<li key={i.id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><StatusIcon s={i.status} /><span><b>{i.label}</b> — {i.detail}</span></li>))}</ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "صفحه‌ها (ضعیف‌ترین اول)", "Pages (weakest first)", "Seiten (schwächste zuerst)")}</p>
                    <div className="space-y-1.5">
                      {[...detail.pages].sort((a, b) => a.score - b.score).map((p) => (
                        <div key={p.url} className="rounded-xl overflow-hidden" style={{ background: "var(--surface-2)" }}>
                          <button onClick={() => toggle(p.url)} className="w-full flex items-center gap-3 px-3 py-2 text-start">
                            <span className="text-sm font-bold w-8 flex-shrink-0" style={{ color: scoreColor(p.score) }}>{p.score}</span>
                            <span className="flex-1 min-w-0 text-xs truncate" dir="ltr" style={{ color: "var(--text-primary)" }}>{p.url.replace(/^https?:\/\//, "")}</span>
                            <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{p.issues.length} {tri(lang, "مورد", "issues", "Punkte")}</span>
                            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)", transform: open.has(p.url) ? "rotate(180deg)" : undefined }} />
                          </button>
                          {open.has(p.url) && (
                            <ul className="px-3 pb-3 space-y-1.5">
                              {p.issues.length === 0 && <li className="text-xs" style={{ color: "#22c55e" }}>{tri(lang, "مشکلی پیدا نشد", "No issues found", "Keine Probleme gefunden")}</li>}
                              {p.issues.map((i) => (<li key={i.id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><StatusIcon s={i.status} /><span><b>{i.label}</b> — {i.detail}</span></li>))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {history.length > 1 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "تاریخچه تحلیل‌ها", "Audit history", "Analyse-Verlauf")}</p>
                      <div className="space-y-1">
                        {history.slice(0, 15).map((a) => (
                          <button key={a.id} onClick={() => loadAudit(a.id)} className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs text-start" style={{ background: a.id === detail.audit.id ? "var(--surface-2)" : "transparent", color: "var(--text-secondary)" }}>
                            <span className="font-bold w-8" style={{ color: scoreColor(a.score) }}>{a.score}</span>
                            <span className="flex-1">{fmt(a.createdAt)}</span>
                            <span className="opacity-70">{a.source === "auto" ? tri(lang, "خودکار", "scheduled", "geplant") : tri(lang, "دستی", "manual", "manuell")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {GSC_ENABLED && selected && <RankingsCard siteId={selected.id} />}
          {selected && <ContentPlanCard siteId={selected.id} />}
        </>
      )}
    </div>
  );
}
