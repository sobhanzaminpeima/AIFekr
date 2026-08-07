"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Image as ImageIcon, Wand2, Download, Loader2, Languages, Upload, X, Sparkles, Gift, Coins, Copy, Check, User, Package, Mountain, Palette, Briefcase, Wand } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

const RATIOS = ["1:1", "16:9", "9:16", "4:3"];

interface PromptTemplate {
  id: string;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  category: string;
  thumbnailUrl: string | null;
}

const CATEGORIES = [
  { id: "all",       fa: "همه",              en: "All",         icon: Sparkles,   gradient: "linear-gradient(135deg, #ea580c, #f97316)" },
  { id: "portrait",  fa: "پرتره",            en: "Portrait",    icon: User,       gradient: "linear-gradient(135deg, #ec4899, #f472b6)" },
  { id: "product",   fa: "محصول",            en: "Product",     icon: Package,    gradient: "linear-gradient(135deg, #06b6d4, #0ea5e9)" },
  { id: "landscape", fa: "منظره و طبیعت",    en: "Landscape",   icon: Mountain,   gradient: "linear-gradient(135deg, #10b981, #22c55e)" },
  { id: "art",       fa: "هنری و نقاشی",     en: "Art",         icon: Palette,    gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
  { id: "corporate", fa: "کسب‌وکار",         en: "Corporate",   icon: Briefcase,  gradient: "linear-gradient(135deg, #3b82f6, #6366f1)" },
  { id: "fantasy",   fa: "فانتزی و سینمایی", en: "Fantasy",     icon: Wand,       gradient: "linear-gradient(135deg, #f59e0b, #ea580c)" },
];

// Minimal shape of the global `puter` object injected by https://js.puter.com/v2/.
// Must match the declaration in tools/try-free-ai/page.tsx exactly (TS merges global
// augmentations across files and errors if the shapes differ).
declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (prompt: string, opts?: { model?: string }) => Promise<string>;
        txt2img: (prompt: string, opts?: { model?: string }) => Promise<HTMLImageElement>;
      };
    };
  }
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
  const [activeCategory, setActiveCategory] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [mode, setMode] = useState<"credits" | "puter">("credits");
  const [puterReady, setPuterReady] = useState(false);

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

  function templateText(tpl: PromptTemplate) {
    return !isFa && tpl.contentEn ? tpl.contentEn : tpl.content;
  }

  function pickTemplate(tpl: PromptTemplate) {
    setPrompt(templateText(tpl));
    setShowTemplates(false);
    fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tpl.id }),
    }).catch(() => {});
  }

  async function copyTemplate(tpl: PromptTemplate) {
    try {
      await navigator.clipboard.writeText(templateText(tpl));
      setCopiedId(tpl.id);
      toast.success(isFa ? "پرامپت کپی شد" : "Prompt copied");
      setTimeout(() => setCopiedId((v) => (v === tpl.id ? null : v)), 1500);
    } catch {
      toast.error(isFa ? "کپی ناموفق بود" : "Copy failed");
    }
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

  async function generateWithPuter() {
    if (!prompt.trim()) { toast.error(s.errEnterPrompt); return; }
    if (!window.puter) { toast.error(s.puterLoginError); return; }
    setLoading(true);
    setResults([]);
    try {
      const styledPrompt = style && style !== "realistic" ? `${prompt}, ${style} style` : prompt;
      const images = await Promise.all(
        Array.from({ length: count }, () =>
          window.puter!.ai.txt2img(styledPrompt, { model: "gpt-image-1-mini" }).then((img) => img.src)
        )
      );
      setResults(images);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : s.puterLoginError);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (mode === "puter") return generateWithPuter();
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
      setResults((data.images || []).map((img: { url: string }) => img.url));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : s.errGenerate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-4xl mx-auto space-y-6">
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setPuterReady(true)} />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
      </div>

      {/* Mode toggle: paid AiFekr credits vs free Puter */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode("credits")}
          className="flex items-center gap-3 p-4 rounded-2xl text-right transition-all"
          style={{
            background: mode === "credits" ? "rgba(234,88,12,0.1)" : "var(--surface-1)",
            border: `1px solid ${mode === "credits" ? "var(--primary)" : "var(--border)"}`,
          }}
        >
          <Coins className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.modeCredits}</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.modeCreditsDesc}</div>
          </div>
        </button>
        <button
          onClick={() => setMode("puter")}
          className="flex items-center gap-3 p-4 rounded-2xl text-right transition-all"
          style={{
            background: mode === "puter" ? "rgba(234,88,12,0.1)" : "var(--surface-1)",
            border: `1px solid ${mode === "puter" ? "var(--primary)" : "var(--border)"}`,
          }}
        >
          <Gift className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.modePuter}</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.modePuterDesc}</div>
          </div>
        </button>
      </div>

      {mode === "puter" && (
        <div className="rounded-2xl p-4 text-xs" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.3)", color: "var(--text-secondary)" }}>
          {s.puterNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Reference photo upload — credits mode only (Puter's txt2img has no reference-image input) */}
          {mode === "credits" && (
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
          )}

          {/* Ready-made prompt gallery trigger */}
          <button
            onClick={() => setShowTemplates(true)}
            className="w-full flex items-center justify-between p-5 rounded-2xl text-sm font-medium transition-all"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} /> {isFa ? "گالری پرامپت‌های آماده" : "Prompt Gallery"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{templates.length}</span>
          </button>

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
            {mode === "credits" && (
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
            )}
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
            disabled={loading || !prompt.trim() || (mode === "puter" && !puterReady)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {loading
              ? (mode === "puter" ? s.puterGenerating : s.generatingText)
              : sourceImageUrl && mode === "credits"
                ? s.generateFromPhoto
                : s.generateBtn}
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

      {/* Prompt gallery modal */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                {isFa ? "گالری پرامپت‌های آماده" : "Prompt Gallery"}
              </h2>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    background: activeCategory === cat.id ? "var(--primary)" : "var(--surface-1)",
                    color: activeCategory === cat.id ? "white" : "var(--text-secondary)",
                    border: `1px solid ${activeCategory === cat.id ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {isFa ? cat.fa : cat.en}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {templates.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{s.noPromptsYet}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates
                    .filter((tpl) => activeCategory === "all" || tpl.category === activeCategory)
                    .map((tpl) => {
                      const cat = CATEGORIES.find((c) => c.id === tpl.category) || CATEGORIES[0];
                      const displayTitle = !isFa && tpl.titleEn ? tpl.titleEn : tpl.title;
                      return (
                        <div
                          key={tpl.id}
                          className="rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-0.5"
                          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
                        >
                          {tpl.thumbnailUrl ? (
                            <img src={tpl.thumbnailUrl} alt={displayTitle} className="w-full h-32 object-cover" />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center" style={{ background: cat.gradient }}>
                              <cat.icon className="w-8 h-8 text-white opacity-90" />
                            </div>
                          )}
                          <div className="p-3.5 flex flex-col gap-2 flex-1">
                            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{displayTitle}</div>
                            <p className="text-xs leading-5 line-clamp-3 flex-1" style={{ color: "var(--text-secondary)" }}>
                              {templateText(tpl)}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => copyTemplate(tpl)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                              >
                                {copiedId === tpl.id ? <Check className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === tpl.id ? (isFa ? "کپی شد" : "Copied") : (isFa ? "کپی" : "Copy")}
                              </button>
                              <button
                                onClick={() => pickTemplate(tpl)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                                style={{ background: "var(--primary)" }}
                              >
                                {isFa ? "استفاده" : "Use"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
