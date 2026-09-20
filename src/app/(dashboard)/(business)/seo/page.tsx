"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Globe, FileText, Tag, Copy, Check, ExternalLink, Zap, Loader2, Link2, Sparkles, BarChart3, MousePointerClick, Eye, TrendingUp, ChevronDown, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import Link from "next/link";
import { useTranslation, tri } from "@/lib/i18n";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import CreditCost from "@/components/ui/CreditCost";
import { normalizeUrlInput } from "@/lib/seo/urlInput";
import { GSC_ENABLED } from "@/lib/seo/features";

type Tab = "url" | "keyword" | "content" | "meta";
type Platform = "wordpress" | "aifekr" | "other";

export default function SEOPage() {
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [url, setUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [content, setContent] = useState("");
  const [pageTopic, setPageTopic] = useState("");
  const [metaKeyword, setMetaKeyword] = useState("");

  // ── Website connection (lets "Apply Automatically" actually write the change) ──
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [connSaving, setConnSaving] = useState(false);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [aifekrWebsiteId, setAifekrWebsiteId] = useState("");
  const [applying, setApplying] = useState(false);

  const PLATFORM_LABELS: Record<Platform, string> = {
    wordpress: t.seo.platformWordpress,
    aifekr: t.seo.platformAifekr,
    other: t.seo.platformOther,
  };

  const loadConnection = useCallback(async () => {
    try {
      const r = await fetch("/api/seo/connection", { credentials: "include" });
      const d = await r.json();
      if (d.connection) {
        setPlatform(d.connection.platform);
        setWpSiteUrl(d.connection.siteUrl || "");
        setWpUsername(d.connection.wpUsername || "");
      }
    } catch {}
  }, []);

  useEffect(() => { loadConnection(); }, [loadConnection]);

  // ── Google Search Console ────────────────────────────────────────────────
  const isFa = lang === "fa";
  const [gscConnected, setGscConnected] = useState(false);
  const [gscSiteUrl, setGscSiteUrl] = useState<string | null>(null);
  const [gscSites, setGscSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [gscSitesLoading, setGscSitesLoading] = useState(false);
  const [gscData, setGscData] = useState<{
    totals: { clicks: number; impressions: number; avgCtr: number; avgPosition: number };
    trend: { date: string; clicks: number; impressions: number }[];
    topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
    opportunities?: { query: string; kind: "striking_distance" | "low_ctr"; clicks: number; impressions: number; ctr: number; position: number; potentialExtraClicks: number }[];
    topPages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  } | null>(null);
  const [gscDataLoading, setGscDataLoading] = useState(false);

  const loadGscStatus = useCallback(async () => {
    if (!GSC_ENABLED) return;
    try {
      const r = await fetch("/api/seo/gsc/status", { credentials: "include" });
      const d = await r.json();
      setGscConnected(!!d.connected);
      setGscSiteUrl(d.siteUrl || null);
    } catch {}
  }, []);

  useEffect(() => {
    loadGscStatus();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gsc");
    if (status === "connected") toast.success(tri(lang, "به Search Console متصل شدی", "Connected to Search Console", "Mit Search Console verbunden"));
    if (status === "failed") toast.error(t.common.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGscStatus]);

  useEffect(() => {
    if (gscConnected && !gscSiteUrl) loadGscSites();
    if (gscConnected && gscSiteUrl) loadGscData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gscConnected, gscSiteUrl]);

  async function loadGscSites() {
    setGscSitesLoading(true);
    try {
      const r = await fetch("/api/seo/gsc/sites", { credentials: "include" });
      const d = await r.json();
      if (r.ok) setGscSites(d.sites || []);
      else if (d.reconnectRequired) { setGscConnected(false); toast.error(d.error || t.common.error); }
      else toast.error(d.error || t.common.error);
    } catch {}
    finally { setGscSitesLoading(false); }
  }

  async function pickGscSite(siteUrl: string) {
    try {
      const r = await fetch("/api/seo/gsc/sites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setGscSiteUrl(d.siteUrl);
    } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
  }

  async function loadGscData() {
    setGscDataLoading(true);
    try {
      const r = await fetch("/api/seo/gsc/data", { credentials: "include" });
      const d = await r.json();
      if (r.ok) setGscData(d);
      else if (d.reconnectRequired) { setGscConnected(false); toast.error(d.error || t.common.error); }
      else toast.error(d.error || t.common.error);
    } catch {}
    finally { setGscDataLoading(false); }
  }

  // ── URL audit checklist ─────────────────────────────────────────────────
  interface UrlCheck { id: string; label: string; status: "pass" | "warning" | "fail"; detail: string; }
  interface UrlCheckGroup { id: string; titleFa: string; titleEn: string; titleDe?: string; checks: UrlCheck[]; }
  const [urlAudit, setUrlAudit] = useState<{ score: number; groups: UrlCheckGroup[] } | null>(null);
  const [urlAuditLoading, setUrlAuditLoading] = useState(false);
  type ImprovePlanView = { summary: string; title: string; metaDescription: string; h1: string; fixes: { priority: "high" | "medium" | "low"; issue: string; action: string }[]; contentIdeas: string[] };
  const [improving, setImproving] = useState(false);
  const [plan, setPlan] = useState<ImprovePlanView | null>(null);
  const [planApplying, setPlanApplying] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  async function improveWithAi() {
    const normalized = normalizeUrlInput(url);
    if (!normalized) return;
    setImproving(true);
    setPlan(null);
    try {
      const r = await fetch("/api/seo/improve", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ url: normalized, targetKeyword, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.common.error);
      setPlan(d.plan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
    } finally {
      setImproving(false);
    }
  }

  // Writes the AI-proposed title/description to the connected site. Only ever runs from an explicit click.
  async function applyPlan() {
    if (!plan || !(plan.title || plan.metaDescription)) return;
    const normalized = normalizeUrlInput(url);
    if (!normalized) return;
    const body: Record<string, string> = { url: normalized };
    if (plan.title) body.title = plan.title;
    if (plan.metaDescription) body.metaDescription = plan.metaDescription;
    if (platform === "aifekr") {
      if (!aifekrWebsiteId) return toast.error(t.common.error);
      body.websiteId = aifekrWebsiteId;
    }
    setPlanApplying(true);
    try {
      const res = await fetch("/api/seo/apply", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(tri(lang, "عنوان و توضیحات روی سایت شما اعمال شد", "Title and description applied to your site", "Titel und Beschreibung wurden auf Ihrer Website übernommen"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
    } finally {
      setPlanApplying(false);
    }
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  }

  async function analyzeUrl() {
    // Accept a bare domain ("mysite.com"); the button used to stay disabled without an explicit https://.
    const normalized = normalizeUrlInput(url);
    if (!normalized) { toast.error(tri(lang, "آدرس وب‌سایت معتبر نیست. مثال: mysite.com", "That doesn't look like a website address. Example: mysite.com", "Das ist keine gültige Website-Adresse. Beispiel: meineseite.de")); return; }
    if (normalized !== url) setUrl(normalized);
    setUrlAuditLoading(true);
    setUrlAudit(null);
    setPlan(null);
    setResult("");
    try {
      const r = await fetch("/api/seo/analyze-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUrlAudit(d);
      setCollapsedGroups(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
    } finally {
      setUrlAuditLoading(false);
    }
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function choosePlatform(p: Platform) {
    setPlatform(p);
    if (p === "other" || p === "aifekr") {
      setConnSaving(true);
      try {
        const r = await fetch("/api/seo/connection", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: p }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success(t.common.save);
      } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
      finally { setConnSaving(false); }
    }
  }

  async function saveWordPressConnection() {
    if (!wpSiteUrl || !wpUsername || !wpAppPassword) return toast.error(t.common.error);
    setConnSaving(true);
    try {
      const r = await fetch("/api/seo/connection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "wordpress", siteUrl: wpSiteUrl, wpUsername, wpAppPassword }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast.success(t.common.save);
    } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
    finally { setConnSaving(false); }
  }

  async function applyChanges() {
    if (!url) return;
    setApplying(true);
    try {
      const sug = await fetch("/api/seo/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, targetKeyword }),
      }).then(r => r.json());
      if (sug.error) throw new Error(sug.error);

      const body: Record<string, string> = { url, title: sug.title, metaDescription: sug.metaDescription };
      if (platform === "aifekr") {
        if (!aifekrWebsiteId) return toast.error(t.common.error);
        body.websiteId = aifekrWebsiteId;
      }
      const res = await fetch("/api/seo/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.common.save);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
    } finally {
      setApplying(false);
    }
  }

  async function analyze(tool: Tab, payload: Record<string, string>) {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, language: lang, ...payload }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const data = part.slice(6);
            if (data === "[DONE]") break;
            try { const j = JSON.parse(data); if (j.text) setResult(prev => prev + j.text); } catch {}
          }
        }
      }
    } catch { setResult(`❌ ${t.common.error}`); }
    finally { setLoading(false); }
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: "url", icon: Globe, label: t.seo.tabUrl },
    { id: "keyword", icon: Search, label: t.seo.tabKeyword },
    { id: "content", icon: FileText, label: t.seo.tabContent },
    { id: "meta", icon: Tag, label: t.seo.tabMeta },
  ];

  return (
    <div className="flex flex-col h-full p-4 gap-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{t.seo.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{t.seo.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <Link
            href="/seo/sites"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {tri(lang, "مانیتور سئو (تحلیل ذخیره‌شده و خودکار)", "SEO Monitor (saved & automatic audits)", "SEO-Monitor (gespeicherte & automatische Analysen)")}
          </Link>
          <Link
            href="/seo/agent-pipeline"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {tri(lang, "خط تولید محتوای هوشمند (۸ Agent)", "Smart Content Pipeline (8 Agents)", "Intelligente Content-Pipeline (8 Agenten)")}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.seo.platformCardTitle}</span>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t.seo.platformCardDescription}
        </p>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
            <button key={p} onClick={() => choosePlatform(p)} disabled={connSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: platform === p ? "var(--primary)" : "var(--surface-2)", color: platform === p ? "white" : "var(--text-secondary)" }}>
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>

        {platform === "wordpress" && (
          <div className="grid sm:grid-cols-3 gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <input value={wpSiteUrl} onChange={e => setWpSiteUrl(e.target.value)} dir="ltr" placeholder={t.seo.wpSiteUrlPlaceholder}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={wpUsername} onChange={e => setWpUsername(e.target.value)} dir="ltr" placeholder={t.seo.wpUsernamePlaceholder}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="flex gap-2">
              <input value={wpAppPassword} onChange={e => setWpAppPassword(e.target.value)} dir="ltr" type="password" placeholder={t.seo.wpAppPasswordPlaceholder}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button onClick={saveWordPressConnection} disabled={connSaving}
                className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {connSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t.seo.wpSave}
              </button>
            </div>
            <p className="sm:col-span-3 text-xs" style={{ color: "var(--text-muted)" }}>
              {t.seo.wpNote}
            </p>
          </div>
        )}

        {platform === "aifekr" && (
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t.seo.aifekrWebsiteIdLabel}</label>
            <input value={aifekrWebsiteId} onChange={e => setAifekrWebsiteId(e.target.value)} dir="ltr" placeholder="website id"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
        )}
      </div>

      {GSC_ENABLED && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Google Search Console</span>
            </div>
            {!gscConnected ? (
              <a href="/api/seo/gsc/connect" className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: "var(--primary)" }}>
                {tri(lang, "اتصال به Search Console", "Connect Search Console", "Mit Search Console verbinden")}
              </a>
            ) : (
              <button onClick={() => { setGscSiteUrl(null); setGscData(null); loadGscSites(); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {tri(lang, "تغییر سایت", "Change site", "Website wechseln")}
              </button>
            )}
          </div>

          {!gscConnected && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {tri(lang,
                "برای دیدن آمار واقعی کلیک، بازدید و رتبهٔ کلمات کلیدی سایتتان همین‌جا، به Google Search Console متصل شوید.",
                "Connect Google Search Console to see your site's real click, impression, and keyword ranking data right here.",
                "Verbinden Sie sich mit Google Search Console, um echte Klick-, Impressionen- und Keyword-Ranking-Daten Ihrer Website hier zu sehen.")}
            </p>
          )}

          {gscConnected && !gscSiteUrl && (
            <div>
              {gscSitesLoading ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> {tri(lang, "در حال دریافت لیست سایت‌ها...", "Loading your sites...", "Websites werden geladen...")}
                </div>
              ) : gscSites.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "هیچ سایت تایید‌شده‌ای در حساب Search Console شما پیدا نشد.", "No verified sites found in your Search Console account.", "Keine verifizierten Websites in Ihrem Search Console-Konto gefunden.")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کدوم سایت رو می‌خوای ببینی؟", "Which site do you want to view?", "Welche Website möchten Sie ansehen?")}</p>
                  {gscSites.map((s) => (
                    <button key={s.siteUrl} onClick={() => pickGscSite(s.siteUrl)} dir="ltr"
                      className="w-full text-left px-3 py-2 rounded-lg text-xs" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                      {s.siteUrl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {gscConnected && gscSiteUrl && (
            <div>
              <p className="text-xs mb-3" dir="ltr" style={{ color: "var(--text-muted)" }}>{gscSiteUrl}</p>
              {gscDataLoading && !gscData ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} /></div>
              ) : gscData ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center gap-1.5 mb-1"><MousePointerClick className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "کلیک", "Clicks", "Klicks")}</span></div>
                      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{gscData.totals.clicks.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center gap-1.5 mb-1"><Eye className="w-3.5 h-3.5" style={{ color: "#8b5cf6" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "بازدید", "Impressions", "Impressionen")}</span></div>
                      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{gscData.totals.impressions.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>CTR</span></div>
                      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{gscData.totals.avgCtr.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center gap-1.5 mb-1"><Search className="w-3.5 h-3.5" style={{ color: "#eab308" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "رتبه میانگین", "Avg. position", "Ø Position")}</span></div>
                      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{gscData.totals.avgPosition.toFixed(1)}</p>
                    </div>
                  </div>

                  {gscData.trend.length >= 2 && (
                    <div className="rounded-xl p-3 mb-4" style={{ background: "var(--surface-2)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "روند ۲۸ روز اخیر", "Last 28 days", "Letzte 28 Tage")}</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={gscData.trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                          <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                          <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} name={tri(lang, "کلیک", "Clicks", "Klicks")} />
                          <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} name={tri(lang, "بازدید", "Impressions", "Impressionen")} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {gscData.opportunities && gscData.opportunities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "فرصت‌های رشد (از داده واقعی Search Console)", "Growth opportunities (from your real Search Console data)", "Wachstumschancen (aus Ihren echten Search-Console-Daten)")}</p>
                      <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "برآورد کلیک اضافه بر اساس نمایش واقعی و میانگین CTR صنعت است، نه تضمین.", "Extra-click figures use your real impressions and typical industry CTR; they are estimates, not promises.", "Die Mehrklicks basieren auf Ihren echten Impressionen und dem üblichen Branchen-CTR – Schätzungen, keine Zusagen.")}</p>
                      <div className="space-y-1">
                        {gscData.opportunities.map((o, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: i % 2 === 0 ? "var(--surface-2)" : "transparent" }}>
                            <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>{o.query}</span>
                            <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                              {o.kind === "striking_distance"
                                ? tri(lang, "رتبه " + o.position.toFixed(1) + " — نزدیک به ۳ برتر", "pos " + o.position.toFixed(1) + " — near the top 3", "Pos. " + o.position.toFixed(1) + " — nahe den Top 3")
                                : tri(lang, "CTR پایین (" + o.ctr.toFixed(1) + "٪) — عنوان/توضیحات را بازنویسی کنید", "low CTR (" + o.ctr.toFixed(1) + "%) — rewrite title/description", "niedrige CTR (" + o.ctr.toFixed(1) + " %) — Titel/Beschreibung überarbeiten")}
                              {" · +" + o.potentialExtraClicks}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پرکلیک‌ترین کلمات کلیدی", "Top queries", "Top-Abfragen")}</p>
                      <div className="space-y-1">
                        {gscData.topQueries.slice(0, 10).map((q, i) => (
                          <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: i % 2 === 0 ? "var(--surface-2)" : "transparent" }}>
                            <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>{q.query}</span>
                            <span className="flex-shrink-0 mr-2" style={{ color: "var(--text-muted)" }}>{q.clicks} / {q.impressions}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پرکلیک‌ترین صفحات", "Top pages", "Top-Seiten")}</p>
                      <div className="space-y-1">
                        {gscData.topPages.slice(0, 10).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: i % 2 === 0 ? "var(--surface-2)" : "transparent" }}>
                            <span className="truncate flex-1" dir="ltr" style={{ color: "var(--text-primary)" }}>{p.page.replace(/^https?:\/\//, "")}</span>
                            <span className="flex-shrink-0 mr-2" style={{ color: "var(--text-muted)" }}>{p.clicks} / {p.impressions}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => { setActiveTab(tb.id); setResult(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: activeTab === tb.id ? "var(--primary)" : "var(--surface-2)", color: activeTab === tb.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <tb.icon className="w-4 h-4" />{tb.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {activeTab === "url" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.urlLabel}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input value={url} onChange={e => setUrl(e.target.value)} dir="ltr" placeholder="https://example.com"
                    className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.seo.targetKeywordLabel}</label>
              <input value={targetKeyword} onChange={e => setTargetKeyword(e.target.value)} placeholder={t.seo.targetKeywordPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={urlAuditLoading || !url.trim()} onClick={analyzeUrl}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Globe className="w-4 h-4" />{urlAuditLoading ? t.seo.analyzing : t.seo.analyzeButton}
            </button>
            {urlAudit && !urlAuditLoading && (
              <button disabled={improving} onClick={improveWithAi}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,var(--primary),#8b5cf6)" }}>
                {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {improving ? tri(lang, "در حال تهیه برنامه بهبود...", "Building your improvement plan...", "Verbesserungsplan wird erstellt...") : tri(lang, "بهبود با هوش مصنوعی", "Improve with AI", "Mit KI verbessern")} <CreditCost feature="seo.improve" />
              </button>
            )}
            {platform && platform !== "other" && urlAudit && !urlAuditLoading && (
              <button disabled={applying} onClick={applyChanges}
                className="w-full py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--surface-2)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {applying ? t.seo.applying : t.seo.applyButton} <CreditCost feature="seo.suggest" />
              </button>
            )}
          </>
        )}

        {activeTab === "keyword" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.keywordLabel}</label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder={t.seo.keywordPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !keyword} onClick={() => analyze("keyword", { keyword })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Search className="w-4 h-4" />{loading ? t.seo.analyzing : t.seo.researchButton} <CreditCost feature="seo.analyze" />
            </button>
          </>
        )}

        {activeTab === "content" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.contentKeywordLabel}</label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder={t.seo.keywordPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.contentLabel}</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder={t.seo.contentPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !keyword || !content} onClick={() => analyze("content", { keyword, content })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <FileText className="w-4 h-4" />{loading ? t.seo.optimizing : t.seo.optimizeButton} <CreditCost feature="seo.analyze" />
            </button>
          </>
        )}

        {activeTab === "meta" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.metaPageTopicLabel}</label>
              <input value={pageTopic} onChange={e => setPageTopic(e.target.value)} placeholder={t.seo.metaPageTopicPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.metaKeywordLabel}</label>
              <input value={metaKeyword} onChange={e => setMetaKeyword(e.target.value)} placeholder={t.seo.metaKeywordPlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !pageTopic || !metaKeyword} onClick={() => analyze("meta", { keyword: metaKeyword, content: pageTopic })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Tag className="w-4 h-4" />{loading ? t.seo.generating : t.seo.metaGenerateButton} <CreditCost feature="seo.analyze" />
            </button>
          </>
        )}
      </div>

      {activeTab === "url" && (urlAuditLoading || urlAudit) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          {urlAuditLoading && !urlAudit ? (
            <div className="p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{t.seo.analyzing}</span>
            </div>
          ) : urlAudit ? (
            <>
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-xs" dir="ltr" style={{ color: "var(--text-muted)" }}>{url}</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: urlAudit.score >= 80 ? "#22c55e" : urlAudit.score >= 60 ? "#eab308" : "#ef4444" }}>{urlAudit.score}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</span>
                </div>
              </div>
              {urlAudit.groups.map((group) => {
                const isOpen = !collapsedGroups.has(group.id);
                const failCount = group.checks.filter((c) => c.status === "fail").length;
                const warnCount = group.checks.filter((c) => c.status === "warning").length;
                return (
                  <div key={group.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between px-5 py-3" style={{ background: "var(--surface-2)" }}>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, group.titleFa, group.titleEn, group.titleDe || group.titleEn)}</span>
                      <div className="flex items-center gap-2">
                        {failCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{failCount}</span>}
                        {warnCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(234,179,8,0.15)", color: "#eab308" }}>{warnCount}</span>}
                        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div>
                        {group.checks.map((c) => (
                          <div key={c.id} className="flex items-start gap-3 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                            {c.status === "pass" ? (
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#22c55e" }} />
                            ) : c.status === "warning" ? (
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#eab308" }} />
                            ) : (
                              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.label}</p>
                              <p className="text-xs mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>{c.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {plan && (
                <div className="p-5 space-y-4" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "برنامه بهبود سئو (بر پایه بررسی واقعی صفحه شما)", "SEO improvement plan (based on the real audit of your page)", "SEO-Verbesserungsplan (auf Basis der echten Prüfung Ihrer Seite)")}</span>
                  </div>
                  {plan.summary && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{plan.summary}</p>}

                  {[
                    { key: "title", label: tri(lang, "عنوان پیشنهادی (Title)", "Suggested title", "Vorgeschlagener Titel"), value: plan.title, max: 60 },
                    { key: "meta", label: tri(lang, "توضیحات پیشنهادی (Meta Description)", "Suggested meta description", "Vorgeschlagene Meta-Beschreibung"), value: plan.metaDescription, max: 160 },
                    { key: "h1", label: tri(lang, "H1 پیشنهادی", "Suggested H1", "Vorgeschlagene H1"), value: plan.h1, max: 0 },
                  ].filter((f) => f.value).map((f) => (
                    <div key={f.key} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{f.label}{f.max ? ` · ${f.value.length}/${f.max}` : ""}</span>
                        <button onClick={() => copyText(f.key, f.value)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                          {copiedKey === f.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copiedKey === f.key ? t.seo.copied : t.seo.copy}
                        </button>
                      </div>
                      <p className="text-sm break-words" style={{ color: "var(--text-primary)" }}>{f.value}</p>
                    </div>
                  ))}

                  {plan.fixes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "اقدامات به ترتیب اولویت", "Actions in priority order", "Maßnahmen nach Priorität")}</p>
                      <div className="space-y-2">
                        {plan.fixes.map((f, i) => (
                          <div key={i} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: f.priority === "high" ? "rgba(239,68,68,0.15)" : f.priority === "medium" ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.15)", color: f.priority === "high" ? "#ef4444" : f.priority === "medium" ? "#eab308" : "#22c55e" }}>
                                {f.priority === "high" ? tri(lang, "بالا", "High", "Hoch") : f.priority === "medium" ? tri(lang, "متوسط", "Medium", "Mittel") : tri(lang, "کم", "Low", "Niedrig")}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.issue}</p>
                                <p className="text-xs mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>{f.action}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {plan.contentIdeas.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "ایده‌های محتوا برای این صفحه", "Content ideas for this page", "Content-Ideen für diese Seite")}</p>
                      <ul className="list-disc ps-5 text-xs space-y-0.5" style={{ color: "var(--text-muted)" }}>{plan.contentIdeas.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}

                  {platform && platform !== "other" ? (
                    <button disabled={planApplying || !(plan.title || plan.metaDescription)} onClick={applyPlan}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: "var(--surface-1)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
                      {planApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {tri(lang, "اعمال عنوان و توضیحات روی سایت من", "Apply title & description to my site", "Titel & Beschreibung auf meiner Website übernehmen")}
                    </button>
                  ) : (
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "برای اعمال خودکار، پلتفرم سایت (مثلاً وردپرس) را بالای صفحه متصل کنید؛ وگرنه موارد بالا را کپی و دستی جایگذاری کنید.", "To apply automatically, connect your site platform (e.g. WordPress) at the top of the page; otherwise copy the items above and paste them in yourself.", "Zum automatischen Übernehmen verbinden Sie oben Ihre Website-Plattform (z. B. WordPress); andernfalls kopieren Sie die Punkte oben manuell.")}</p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {activeTab !== "url" && (result || loading) && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t.seo.resultTitle}</span>
            {result && (
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t.seo.copied : t.seo.copy}
              </button>
            )}
          </div>
          <div className="prose prose-invert prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
            {loading && !result && <div className="animate-pulse text-sm" style={{ color: "var(--text-muted)" }}>{t.seo.analyzing}</div>}
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
