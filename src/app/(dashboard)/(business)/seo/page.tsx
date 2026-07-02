"use client";

import { useState } from "react";
import { Search, Globe, FileText, Tag, Copy, Check, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Tab = "url" | "keyword" | "content" | "meta";

export default function SEOPage() {
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

  async function analyze(tool: Tab, payload: Record<string, string>) {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, ...payload }),
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
    } catch { setResult("❌ خطا در ارتباط با سرور"); }
    finally { setLoading(false); }
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: "url", icon: Globe, label: "آنالیز URL" },
    { id: "keyword", icon: Search, label: "کلمات کلیدی" },
    { id: "content", icon: FileText, label: "بهینه محتوا" },
    { id: "meta", icon: Tag, label: "Meta Tags" },
  ];

  return (
    <div className="flex flex-col h-full p-4 gap-4 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>فضای کار سئو حرفه‌ای</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>تحلیل URL، تحقیق کلمات کلیدی، بهینه‌سازی محتوا</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setResult(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: activeTab === t.id ? "var(--primary)" : "var(--surface-2)", color: activeTab === t.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {activeTab === "url" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>آدرس وبسایت</label>
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
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>کلمه کلیدی هدف (اختیاری)</label>
              <input value={targetKeyword} onChange={e => setTargetKeyword(e.target.value)} placeholder="مثال: طراحی سایت"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !url.startsWith("http")} onClick={() => analyze("url", { url, targetKeyword })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Globe className="w-4 h-4" />{loading ? "در حال تحلیل..." : "تحلیل وبسایت"}
            </button>
          </>
        )}

        {activeTab === "keyword" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>کلمه کلیدی یا موضوع</label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="مثال: طراحی سایت تهران"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !keyword} onClick={() => analyze("keyword", { keyword })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Search className="w-4 h-4" />{loading ? "در حال تحلیل..." : "تحقیق کلمات کلیدی"}
            </button>
          </>
        )}

        {activeTab === "content" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>کلمه کلیدی هدف</label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="کلمه کلیدی اصلی"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>محتوای شما</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="متن مقاله یا محتوای صفحه را اینجا بنویسید..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !keyword || !content} onClick={() => analyze("content", { keyword, content })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <FileText className="w-4 h-4" />{loading ? "در حال بهینه‌سازی..." : "بهینه‌سازی محتوا"}
            </button>
          </>
        )}

        {activeTab === "meta" && (
          <>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>موضوع صفحه</label>
              <input value={pageTopic} onChange={e => setPageTopic(e.target.value)} placeholder="توضیح کوتاه درباره صفحه"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>کلمه کلیدی اصلی</label>
              <input value={metaKeyword} onChange={e => setMetaKeyword(e.target.value)} placeholder="کلمه کلیدی هدف"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button disabled={loading || !pageTopic || !metaKeyword} onClick={() => analyze("meta", { keyword: metaKeyword, content: pageTopic })}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "var(--primary)" }}>
              <Tag className="w-4 h-4" />{loading ? "در حال تولید..." : "تولید Meta Tags"}
            </button>
          </>
        )}
      </div>

      {(result || loading) && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>نتیجه تحلیل</span>
            {result && (
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "کپی شد" : "کپی"}
              </button>
            )}
          </div>
          <div className="prose prose-invert prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
            {loading && !result && <div className="animate-pulse text-sm" style={{ color: "var(--text-muted)" }}>در حال تحلیل...</div>}
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
