"use client";

import { useState } from "react";
import { Rocket, Send, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

type Lang = "fa" | "en";

export default function StartupContactPage() {
  const [lang, setLang] = useState<Lang>("fa");
  const dir = lang === "fa" ? "rtl" : "ltr";

  const [form, setForm] = useState({ name: "", email: "", phone: "", startupName: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const T = {
    fa: {
      title: "پیاده‌سازی استارتاپ با تیم AIFekr",
      subtitle: "تیم حرفه‌ای ما ایده شما را از صفر تا محصول کامل پیاده‌سازی می‌کند",
      name: "نام و نام خانوادگی *",
      email: "ایمیل *",
      phone: "شماره تلفن",
      startupName: "نام استارتاپ",
      message: "توضیح ایده و نیاز شما *",
      messagePlaceholder: "ایده‌تان را توضیح دهید، در کجا هستید، چه چیزی نیاز دارید...",
      send: "ارسال درخواست",
      sending: "در حال ارسال...",
      successTitle: "درخواست شما ثبت شد!",
      successDesc: "تیم AIFekr در اسرع وقت با شما تماس می‌گیرد.",
      backBtn: "بازگشت به سازنده استارتاپ",
      features: [
        { icon: "🎯", title: "طراحی MVP", desc: "طراحی و توسعه نسخه اول محصول شما" },
        { icon: "🤖", title: "هوش مصنوعی سفارشی", desc: "یکپارچه‌سازی AI متناسب با کسب‌وکارتان" },
        { icon: "📊", title: "داشبورد تحلیلی", desc: "پنل مدیریت و آمار حرفه‌ای" },
        { icon: "🚀", title: "لانچ و دیپلوی", desc: "راه‌اندازی کامل روی سرور" },
      ],
    },
    en: {
      title: "Build Your Startup with AIFekr Team",
      subtitle: "Our professional team takes your idea from zero to a complete product",
      name: "Full Name *",
      email: "Email *",
      phone: "Phone Number",
      startupName: "Startup Name",
      message: "Describe your idea and needs *",
      messagePlaceholder: "Describe your idea, where you are, what you need...",
      send: "Send Request",
      sending: "Sending...",
      successTitle: "Request Submitted!",
      successDesc: "The AIFekr team will contact you as soon as possible.",
      backBtn: "Back to Startup Builder",
      features: [
        { icon: "🎯", title: "MVP Design", desc: "Design and develop the first version of your product" },
        { icon: "🤖", title: "Custom AI", desc: "AI integration tailored to your business" },
        { icon: "📊", title: "Analytics Dashboard", desc: "Professional management panel and statistics" },
        { icon: "🚀", title: "Launch & Deploy", desc: "Full deployment on server" },
      ],
    },
  };
  const t = T[lang];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/startup/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ارسال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <Link
          href="/startup/builder"
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowRight className={`w-4 h-4 ${lang === "fa" ? "" : "rotate-180"}`} />
          {t.backBtn}
        </Link>
        <button
          onClick={() => setLang((l) => (l === "fa" ? "en" : "fa"))}
          className="px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {lang === "fa" ? "English" : "فارسی"}
        </button>
      </div>

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
          <Rocket className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{t.title}</h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>{t.subtitle}</p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {t.features.map((f, i) => (
          <div key={i} className="p-4 rounded-2xl text-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{f.title}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Form / Success */}
      {sent ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <CheckCircle2 className="w-16 h-16 mb-4" style={{ color: "#10b981" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t.successTitle}</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t.successDesc}</p>
          <Link
            href="/startup/builder"
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "var(--primary)" }}
          >
            {t.backBtn}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.name}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.email}</label>
              <input
                required
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.phone}</label>
              <input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.startupName}</label>
              <input
                value={form.startupName}
                onChange={(e) => setForm((p) => ({ ...p, startupName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.message}</label>
            <textarea
              required
              rows={5}
              value={form.message}
              placeholder={t.messagePlaceholder}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.sending}</> : <><Send className="w-5 h-5" /> {t.send}</>}
          </button>
        </form>
      )}
    </div>
  );
}
