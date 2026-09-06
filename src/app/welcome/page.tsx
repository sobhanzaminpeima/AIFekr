"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";

// Onboarding is the very first screen a new account sees, and it was
// Persian-only with a hardcoded dir="rtl" — an English or German signup was
// asked three questions they could not read before reaching the product.

const BUSINESS_TYPES: { id: string; emoji: string; label: Record<Lang, string> }[] = [
  { id: "retail", emoji: "🛍️", label: { fa: "فروشگاه / خرده‌فروشی", en: "Shop / retail", de: "Laden / Einzelhandel" } },
  { id: "services", emoji: "💼", label: { fa: "خدمات / مشاوره", en: "Services / consulting", de: "Dienstleistung / Beratung" } },
  { id: "restaurant", emoji: "☕", label: { fa: "رستوران / کافه", en: "Restaurant / café", de: "Restaurant / Café" } },
  { id: "tech", emoji: "💻", label: { fa: "فناوری / نرم‌افزار", en: "Technology / software", de: "Technologie / Software" } },
  { id: "production", emoji: "🏭", label: { fa: "تولید / صنعت", en: "Manufacturing / industry", de: "Produktion / Industrie" } },
  { id: "other", emoji: "✨", label: { fa: "سایر", en: "Something else", de: "Sonstiges" } },
];

const GOALS: { id: string; emoji: string; label: Record<Lang, string> }[] = [
  { id: "content", emoji: "✍️", label: { fa: "تولید محتوا و مقاله", en: "Content and article writing", de: "Content- und Artikelerstellung" } },
  { id: "analysis", emoji: "📊", label: { fa: "آنالیز و مشاوره کسب‌وکار", en: "Business analysis and advice", de: "Geschäftsanalyse und Beratung" } },
  { id: "social", emoji: "📱", label: { fa: "مدیریت شبکه اجتماعی", en: "Social media management", de: "Social-Media-Management" } },
  { id: "startup", emoji: "🚀", label: { fa: "ساخت استارتاپ / ایده", en: "Building a startup or idea", de: "Ein Startup oder eine Idee aufbauen" } },
  { id: "chat", emoji: "🤖", label: { fa: "دستیار هوشمند برای سوالات", en: "A smart assistant for questions", de: "Ein intelligenter Assistent für Fragen" } },
  { id: "image", emoji: "🎨", label: { fa: "تولید تصویر و ویدئو", en: "Image and video generation", de: "Bild- und Videoerstellung" } },
];

const EXPERIENCES: { id: string; label: Record<Lang, string> }[] = [
  { id: "none", label: { fa: "تازه‌کار — هرگز از AI استفاده نکردم", en: "New to this — I have never used AI", de: "Neu dabei — ich habe noch nie KI genutzt" } },
  { id: "some", label: { fa: "کمی آشنا — ChatGPT را امتحان کردم", en: "Somewhat familiar — I have tried ChatGPT", de: "Etwas vertraut — ich habe ChatGPT ausprobiert" } },
  { id: "pro", label: { fa: "حرفه‌ای — به طور منظم از AI استفاده می‌کنم", en: "Experienced — I use AI regularly", de: "Erfahren — ich nutze KI regelmäßig" } },
];

export default function WelcomePage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const rtl = lang === "fa";
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
    router.push(data.redirect || "/home");
  }

  const steps = [
    {
      question: tri(lang, "کسب‌وکار شما در چه حوزه‌ایست؟", "What field is your business in?", "In welcher Branche ist Ihr Unternehmen tätig?"),
      options: BUSINESS_TYPES,
      key: "businessType" as const,
    },
    {
      question: tri(lang, "بیشتر می‌خواید از AiFekr برای چه کاری استفاده کنید؟", "What do you mainly want to use AiFekr for?", "Wofür möchten Sie AiFekr hauptsächlich nutzen?"),
      options: GOALS,
      key: "goal" as const,
    },
    {
      question: tri(lang, "تجربه شما با هوش مصنوعی چقدر است؟", "How much experience do you have with AI?", "Wie viel Erfahrung haben Sie mit KI?"),
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
      dir={rtl ? "rtl" : "ltr"}
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
                color: "#fff", fontSize: 15, fontWeight: 500, textAlign: rtl ? "right" : "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(234,88,12,0.12)", e.currentTarget.style.borderColor = "rgba(234,88,12,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)", e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              {"emoji" in opt && <span style={{ fontSize: 20 }}>{opt.emoji}</span>}
              {opt.label[lang]}
            </button>
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={() => router.push("/home")}
          style={{ marginTop: 24, background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          {rtl ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}{" "}
          {tri(lang, "رد کردن و ورود به داشبورد", "Skip and go to the dashboard", "Überspringen und zum Dashboard")}
        </button>
      </div>

      <p style={{ marginTop: 24, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        {tri(lang, "این اطلاعات فقط برای راهنمایی بهتر استفاده می‌شود", "This is only used to guide you better", "Diese Angaben dienen nur einer besseren Beratung")}
      </p>
    </div>
  );
}
