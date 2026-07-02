"use client";

import { useState } from "react";
import { Share2, Copy, Check, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter/X", "Facebook", "TikTok"];
const TONES = [
  { value: "Professional", label: "حرفه‌ای" },
  { value: "Casual", label: "غیررسمی" },
  { value: "Funny", label: "طنز" },
  { value: "Inspirational", label: "الهام‌بخش" },
  { value: "Educational", label: "آموزشی" },
];

export default function SocialPage() {
  const [form, setForm] = useState({
    brandName: "",
    topic: "",
    platform: "Instagram",
    tone: "Professional",
    hashtags: true,
    emojis: true,
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(type: "posts" | "calendar") {
    const setter = type === "calendar" ? setCalendarLoading : setLoading;
    setter(true);
    setResult("");

    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const p = JSON.parse(data);
            if (p.text) setResult((prev) => prev + p.text);
          } catch {}
        }
      }
    } catch (err) { console.error(err); }
    finally { setter(false); }
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Share2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>عامل شبکه‌های اجتماعی</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>تولید محتوای بهینه برای هر پلتفرم</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>نام برند / کسب‌وکار</label>
              <input
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder="مثال: کافه پارس"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>موضوع پست یا محصول</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="مثال: لانچ محصول جدید، تخفیف ۲۰٪..."
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>پلتفرم</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm({ ...form, platform: p })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.platform === p ? "var(--primary)" : "var(--surface-2)",
                      color: form.platform === p ? "white" : "var(--text-secondary)",
                      border: form.platform === p ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>لحن</label>
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hashtags}
                  onChange={(e) => setForm({ ...form, hashtags: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>هشتگ داشته باشد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emojis}
                  onChange={(e) => setForm({ ...form, emojis: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>ایموجی داشته باشد</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => generate("posts")}
              disabled={!form.brandName || !form.topic || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Share2 className="w-4 h-4" />}
              تولید پست
            </button>
            <button
              onClick={() => generate("calendar")}
              disabled={!form.brandName || !form.topic || calendarLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {calendarLoading ? <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
              تقویم محتوایی ۷ روزه
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>محتوای تولید شده</h2>
              <button
                onClick={copyResult}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "کپی شد" : "کپی همه"}
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
