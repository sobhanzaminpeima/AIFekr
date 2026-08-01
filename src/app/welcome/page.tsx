"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

const BUSINESS_TYPES = [
  { id: "retail", label: "فروشگاه / خرده‌فروشی", emoji: "🛍️" },
  { id: "services", label: "خدمات / مشاوره", emoji: "💼" },
  { id: "restaurant", label: "رستوران / کافه", emoji: "☕" },
  { id: "tech", label: "فناوری / نرم‌افزار", emoji: "💻" },
  { id: "production", label: "تولید / صنعت", emoji: "🏭" },
  { id: "other", label: "سایر", emoji: "✨" },
];

const GOALS = [
  { id: "content", label: "تولید محتوا و مقاله", emoji: "✍️" },
  { id: "analysis", label: "آنالیز و مشاوره کسب‌وکار", emoji: "📊" },
  { id: "social", label: "مدیریت شبکه اجتماعی", emoji: "📱" },
  { id: "startup", label: "ساخت استارتاپ / ایده", emoji: "🚀" },
  { id: "chat", label: "دستیار هوشمند برای سوالات", emoji: "🤖" },
  { id: "image", label: "تولید تصویر و ویدئو", emoji: "🎨" },
];

const EXPERIENCES = [
  { id: "none", label: "تازه‌کار — هرگز از AI استفاده نکردم" },
  { id: "some", label: "کمی آشنا — ChatGPT را امتحان کردم" },
  { id: "pro", label: "حرفه‌ای — به طور منظم از AI استفاده می‌کنم" },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ businessType: "", goal: "", experience: "" });
  const [loading, setLoading] = useState(false);

  async function finish(experience: string) {
    const final = { ...answers, experience };
    setLoading(true);
    const res = await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(final),
    });
    const data = await res.json();
    router.push(data.redirect || "/chat");
  }

  const steps = [
    {
      question: "کسب‌وکار شما در چه حوزه‌ایست؟",
      options: BUSINESS_TYPES,
      key: "businessType" as const,
    },
    {
      question: "بیشتر می‌خواید از AiFekr برای چه کاری استفاده کنید؟",
      options: GOALS,
      key: "goal" as const,
    },
    {
      question: "تجربه شما با هوش مصنوعی چقدر است؟",
      options: EXPERIENCES,
      key: "experience" as const,
    },
  ];

  const current = steps[step];

  function select(value: string) {
    const updated = { ...answers, [current.key]: value };
    setAnswers(updated);
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      finish(value);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 100%)",
        padding: "24px",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#ea580c,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff" }}>A</div>
        <span style={{ fontWeight: 700, fontSize: 20, color: "#fff" }}>AiFekr</span>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 520, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "40px 36px" }}>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 36 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? "#ea580c" : "rgba(255,255,255,0.12)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Question */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Sparkles size={20} style={{ color: "#ea580c", flexShrink: 0 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.4 }}>
            {current.question}
          </h2>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => select(opt.id)}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff", fontSize: 15, fontWeight: 500, textAlign: "right",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(234,88,12,0.12)", e.currentTarget.style.borderColor = "rgba(234,88,12,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)", e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              {"emoji" in opt && <span style={{ fontSize: 20 }}>{opt.emoji}</span>}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={() => router.push("/chat")}
          style={{ marginTop: 24, background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          <ArrowLeft size={13} /> رد کردن و ورود به داشبورد
        </button>
      </div>

      <p style={{ marginTop: 24, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        این اطلاعات فقط برای راهنمایی بهتر استفاده می‌شود
      </p>
    </div>
  );
}
