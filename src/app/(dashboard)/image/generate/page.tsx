"use client";

import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, Wand2, Download, Loader2, Languages, Upload, X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

const RATIOS = ["1:1", "16:9", "9:16", "4:3"];

interface PromptTemplate {
  id: string;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  thumbnailUrl: string | null;
}

export default function ImageGeneratePage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const s = t.imageGeneratePage;
  const STYLES = s.styles;

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [ratio, setRatio] = useState("1:1");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    fetch("/api/prompts?toolType=image")
      .then((r) => r.json())
      .then((d) => setTemplates(d.prompts || []))
      .catch(() => {});
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSourceImageUrl(data.url);
      toast.success(s.photoUploaded);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : s.errUpload);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function pickTemplate(tpl: PromptTemplate) {
    setPrompt(tpl.content);
    setShowTemplates(false);
    fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tpl.id }),
    }).catch(() => {});
  }

  async function translatePrompt() {
    if (!prompt.trim()) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/image/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt }),
      });
      const data = await res.json();
      setPrompt(data.translated || prompt);
      toast.success(s.translated);
    } catch {
      toast.error(s.errTranslate);
    } finally {
      setTranslating(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) { toast.error(s.errEnterPrompt); return; }
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, ratio, quality, count, sourceImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.urls || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : s.errGenerate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Reference photo upload */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {s.uploadRefLabel}
            </label>
            {sourceImageUrl ? (
              <div className="relative">
                <img src={sourceImageUrl} alt="reference" className="w-full h-32 object-cover rounded-xl" />
                <button
                  onClick={() => setSourceImageUrl(null)}
                  className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed text-xs font-medium transition-all disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {uploading ? s.uploading : s.choosePhoto}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
          </div>

          {/* Ready-made prompt templates */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} /> {s.readyPrompts}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{showTemplates ? s.close : s.view}</span>
            </button>
            {showTemplates && (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {templates.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.noPromptsYet}</p>}
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => pickTemplate(tpl)}
                    className="w-full text-right p-2.5 rounded-xl text-xs transition-all"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                  >
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{tpl.title}</div>
                    {tpl.titleEn && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }} dir="ltr">{tpl.titleEn}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.promptLabel}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={s.promptPlaceholder}
              rows={4}
              className="w-full text-sm rounded-xl px-3 py-2.5 resize-none outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={translatePrompt}
              disabled={translating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              {s.translateBtn}
            </button>
          </div>

          {/* Style */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.styleLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStyle(st.id)}
                  className="py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: style === st.id ? "var(--primary)" : "var(--surface-2)",
                    color: style === st.id ? "white" : "var(--text-secondary)",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ratio & Count */}
          <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>{s.ratioLabel}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className="py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: ratio === r ? "var(--primary)" : "var(--surface-2)",
                      color: ratio === r ? "white" : "var(--text-secondary)",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>{s.qualityLabel}</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["standard", "hd"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q as "standard" | "hd")}
                    className="py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: quality === q ? "var(--primary)" : "var(--surface-2)",
                      color: quality === q ? "white" : "var(--text-secondary)",
                    }}
                  >
                    {q === "standard" ? s.qualityStandard : s.qualityHd}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>{s.countLabel} {count}</label>
              <input
                type="range" min={1} max={4} value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full accent-orange-600"
              />
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {loading ? s.generatingText : sourceImageUrl ? s.generateFromPhoto : s.generateBtn}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {results.map((url, i) => (
                <div key={i} className="relative group rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <img src={url} alt={`${i + 1}`} className="w-full h-auto" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <a
                      href={url}
                      download
                      className="p-2 rounded-xl"
                      style={{ background: "var(--primary)" }}
                    >
                      <Download className="w-5 h-5 text-white" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full min-h-64 flex flex-col items-center justify-center rounded-2xl" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
              <ImageIcon className="w-12 h-12 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{s.resultsPlaceholder}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
