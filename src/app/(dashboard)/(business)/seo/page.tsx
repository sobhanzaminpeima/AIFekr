"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Globe, FileText, Tag, Copy, Check, ExternalLink, Zap, Loader2, Link2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

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
        <Link
          href="/seo/agent-pipeline"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
          style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          خط تولید محتوای هوشمند (۸ Agent)
        </Link>
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
            <button disabled={loading || !url.startsWith("http")} onClick={() => analyze("url", { url, targetKeyword })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Globe className="w-4 h-4" />{loading ? t.seo.analyzing : t.seo.analyzeButton}
            </button>
            {platform && platform !== "other" && result && !loading && (
              <button disabled={applying} onClick={applyChanges}
                className="w-full py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--surface-2)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {applying ? t.seo.applying : t.seo.applyButton}
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
              <Search className="w-4 h-4" />{loading ? t.seo.analyzing : t.seo.researchButton}
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
              <FileText className="w-4 h-4" />{loading ? t.seo.optimizing : t.seo.optimizeButton}
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
              <Tag className="w-4 h-4" />{loading ? t.seo.generating : t.seo.metaGenerateButton}
            </button>
          </>
        )}
      </div>

      {(result || loading) && (
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
