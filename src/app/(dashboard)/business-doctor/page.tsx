"use client";

import { useState, useRef, useEffect } from "react";
import { Stethoscope, Send, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface FormData {
  businessName: string;
  industry: string;
  revenue: string;
  teamSize: string;
  challenge: string;
  goals: string;
}

const INDUSTRIES = [
  "Technology / SaaS", "Retail / E-Commerce", "Restaurant / Food", "Healthcare / Medical",
  "Real Estate", "Construction", "Education", "Finance / Banking", "Manufacturing",
  "Consulting / Services", "Hospitality / Hotel", "Legal", "Marketing / Agency", "Other",
];

export default function BusinessDoctorPage() {
  const [form, setForm] = useState<FormData>({
    businessName: "", industry: "", revenue: "", teamSize: "", challenge: "", goals: "",
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<{ businessName: string; result: string; createdAt: string } | null>(null);
  const [showLast, setShowLast] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/business-doctor")
      .then((r) => r.json())
      .then((d) => { if (d.analysis) setLastAnalysis(d.analysis); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName || !form.industry || !form.challenge) return;
    setLoading(true);
    setResult("");
    setShowLast(false);

    try {
      const res = await fetch("/api/business-doctor", {
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
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) setResult((prev) => prev + parsed.text);
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
            <Stethoscope className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>دکتر کسب‌وکار</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>تشخیص جامع هوش مصنوعی از کسب‌وکار شما</p>
          </div>
        </div>

        {/* Last Analysis Banner */}
        {lastAnalysis && (
          <div className="mb-6 rounded-2xl p-4 cursor-pointer" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
            onClick={() => setShowLast(!showLast)}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>آخرین تحلیل</span>
                <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{lastAnalysis.businessName}</p>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showLast ? "rotate-180" : ""}`} style={{ color: "var(--text-secondary)" }} />
            </div>
            {showLast && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="prose prose-invert max-w-none text-sm" style={{ color: "var(--text-primary)" }}>
                  <ReactMarkdown>{lastAnalysis.result}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text-primary)" }}>اطلاعات کسب‌وکار</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>نام کسب‌وکار *</label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="مثال: فروشگاه دیجیتال پارس"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>صنعت *</label>
              <select
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                required
              >
                <option value="">انتخاب صنعت...</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>درآمد ماهانه</label>
              <input
                type="text"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                placeholder="مثال: ۵۰ میلیون تومان"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>اندازه تیم</label>
              <select
                value={form.teamSize}
                onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">انتخاب...</option>
                <option value="solo">تنها (۱ نفر)</option>
                <option value="2-5">۲ تا ۵ نفر</option>
                <option value="6-15">۶ تا ۱۵ نفر</option>
                <option value="16-50">۱۶ تا ۵۰ نفر</option>
                <option value="50+">بیش از ۵۰ نفر</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>چالش اصلی *</label>
              <textarea
                value={form.challenge}
                onChange={(e) => setForm({ ...form, challenge: e.target.value })}
                placeholder="چالش اصلی کسب‌وکار خود را توضیح دهید..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>اهداف کسب‌وکار</label>
              <textarea
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder="اهداف کلیدی شما برای ۱۲ ماه آینده چیست؟"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: loading ? "var(--surface-2)" : "var(--primary)" }}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />در حال تحلیل...</>
            ) : (
              <><Send className="w-4 h-4" />تحلیل کسب‌وکار من</>
            )}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div ref={resultRef} className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Stethoscope className="w-5 h-5" style={{ color: "var(--primary)" }} />
              گزارش تشخیص کسب‌وکار
            </h2>
            <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
