"use client";

import { useState } from "react";
import { Image as ImageIcon, Wand2, Download, Loader2, Languages } from "lucide-react";
import toast from "react-hot-toast";

const STYLES = [
  { id: "realistic", label: "واقعی" },
  { id: "anime", label: "انیمه" },
  { id: "painting", label: "نقاشی" },
  { id: "minimal", label: "مینیمال" },
  { id: "fantasy", label: "فانتزی" },
  { id: "3d", label: "سه‌بعدی" },
];

const RATIOS = ["1:1", "16:9", "9:16", "4:3"];

export default function ImageGeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [ratio, setRatio] = useState("1:1");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [results, setResults] = useState<string[]>([]);

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
      toast.success("ترجمه شد");
    } catch {
      toast.error("خطا در ترجمه");
    } finally {
      setTranslating(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) { toast.error("توضیحات تصویر را وارد کنید"); return; }
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, ratio, quality, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.urls || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در تولید تصویر");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ساخت تصویر با AI</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>تصویر دلخواه خود را با هوش مصنوعی بسازید</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Prompt */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>توضیحات تصویر</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="مثال: یک منظره زیبای کوهستانی در غروب آفتاب..."
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
              ترجمه به انگلیسی (بهبود کیفیت)
            </button>
          </div>

          {/* Style */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>سبک تصویر</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: style === s.id ? "var(--primary)" : "var(--surface-2)",
                    color: style === s.id ? "white" : "var(--text-secondary)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ratio & Count */}
          <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>نسبت ابعاد</label>
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
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>کیفیت</label>
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
                    {q === "standard" ? "استاندارد (۵ اعتبار)" : "HD (۱۰ اعتبار)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>تعداد: {count}</label>
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
            {loading ? "در حال ساخت تصویر..." : "ساخت تصویر"}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {results.map((url, i) => (
                <div key={i} className="relative group rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <img src={url} alt={`تصویر ${i + 1}`} className="w-full h-auto" />
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
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>تصاویر ساخته‌شده اینجا نمایش داده می‌شوند</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
