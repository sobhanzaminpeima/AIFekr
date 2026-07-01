"use client";

import { useState } from "react";
import { Globe, Copy, Check, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SECTIONS = ["Hero", "About", "Services", "Pricing", "Testimonials", "FAQ", "Contact", "Blog"];
const GOALS = [
  { value: "landing page", label: "صفحه فرود" },
  { value: "portfolio", label: "پورتفولیو" },
  { value: "e-commerce", label: "فروشگاه آنلاین" },
  { value: "blog", label: "وبلاگ" },
  { value: "SaaS", label: "SaaS" },
];
const STYLES = [
  { value: "modern", label: "مدرن" },
  { value: "minimal", label: "مینیمال" },
  { value: "bold", label: "جسورانه" },
  { value: "elegant", label: "زیبا" },
];

export default function WebsiteDesignerPage() {
  const [form, setForm] = useState({
    businessName: "",
    industry: "",
    audience: "",
    goal: "landing page",
    colorPref: "",
    style: "modern",
    sections: ["Hero", "About", "Services", "Contact"] as string[],
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  function toggleSection(s: string) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(s) ? prev.sections.filter((x) => x !== s) : [...prev.sections, s],
    }));
  }

  function extractHtml(text: string) {
    const match = text.match(/```html\n([\s\S]*?)```/);
    return match ? match[1] : null;
  }

  function downloadHtml() {
    const html = extractHtml(result);
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.businessName || "website"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generate() {
    if (!form.businessName || !form.industry) return;
    setLoading(true);
    setResult("");
    setStep(2);

    try {
      const res = await fetch("/api/website-designer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.15)" }}>
            <Globe className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>عامل طراح وبسایت</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>طراحی وبسایت کامل و آماده انتشار با هوش مصنوعی</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-3 mb-6">
          {[1, 2].map((s) => (
            <button key={s} onClick={() => { if (s === 1) setStep(1); }} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step === s ? "var(--primary)" : "var(--surface-2)",
                  color: step === s ? "white" : "var(--text-muted)",
                }}
              >
                {s}
              </div>
              <span className="text-sm" style={{ color: step === s ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s === 1 ? "توضیحات کسب‌وکار" : "وبسایت تولید شده"}
              </span>
              {s === 1 && <span style={{ color: "var(--border)" }}>›</span>}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "businessName", label: "نام کسب‌وکار *", placeholder: "مثال: آژانس دیجیتال مارکتینگ نوین" },
                { key: "industry", label: "صنعت *", placeholder: "مثال: طراحی وبسایت، رستوران، کلینیک..." },
                { key: "audience", label: "مخاطبان هدف", placeholder: "مثال: کسب‌وکارهای کوچک، جوانان ۲۰-۳۵ ساله..." },
                { key: "colorPref", label: "ترجیح رنگ", placeholder: "مثال: آبی و سفید، سبز طبیعی، تیره..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  <input
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>هدف وبسایت</label>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((g) => (
                    <button key={g.value} onClick={() => setForm({ ...form, goal: g.value })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: form.goal === g.value ? "var(--primary)" : "var(--surface-2)",
                        color: form.goal === g.value ? "white" : "var(--text-secondary)",
                        border: form.goal === g.value ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>سبک طراحی</label>
                <div className="flex gap-2">
                  {STYLES.map((s) => (
                    <button key={s.value} onClick={() => setForm({ ...form, style: s.value })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: form.style === s.value ? "var(--primary)" : "var(--surface-2)",
                        color: form.style === s.value ? "white" : "var(--text-secondary)",
                        border: form.style === s.value ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>بخش‌های ضروری</label>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map((s) => (
                    <button key={s} onClick={() => toggleSection(s)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: form.sections.includes(s) ? "rgba(234,88,12,0.2)" : "var(--surface-2)",
                        color: form.sections.includes(s) ? "var(--primary)" : "var(--text-secondary)",
                        border: form.sections.includes(s) ? "1px solid rgba(234,88,12,0.4)" : "1px solid var(--border)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={generate}
              disabled={!form.businessName || !form.industry || loading}
              className="mt-5 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Globe className="w-4 h-4" />}
              طراحی وبسایت
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>وبسایت تولید شده</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "کپی شد" : "کپی کد"}
                </button>
                {extractHtml(result) && (
                  <button
                    onClick={downloadHtml}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    دانلود HTML
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {loading && !result && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <span className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>در حال طراحی وبسایت شما...</span>
                </div>
              )}
              <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
