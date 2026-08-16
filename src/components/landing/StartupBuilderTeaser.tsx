"use client";

import Link from "next/link";
import { Rocket, Lightbulb, DollarSign, FileText, Code2, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  lang: "fa" | "en" | "de";
}

const STEPS = {
  fa: [
    { icon: Lightbulb, label: "ایده‌پردازی", desc: "تحلیل SWOT، ارزش پیشنهادی، مزیت رقابتی", color: "#f59e0b" },
    { icon: DollarSign, label: "مدل مالی", desc: "پیش‌بینی ۳ ساله، نقطه سر به سر، KPI مالی", color: "#10b981" },
    { icon: FileText, label: "پروپوزال سرمایه‌گذار", desc: "پیچ‌دک حرفه‌ای آماده ارائه به VC", color: "#3b82f6" },
    { icon: Code2, label: "برنامه پیاده‌سازی", desc: "معماری فنی، Sprint Plan، چک‌لیست لانچ", color: "#8b5cf6" },
  ],
  en: [
    { icon: Lightbulb, label: "Idea Analysis", desc: "SWOT, value proposition, competitive advantage", color: "#f59e0b" },
    { icon: DollarSign, label: "Financial Model", desc: "3-year forecast, break-even, financial KPIs", color: "#10b981" },
    { icon: FileText, label: "Investor Proposal", desc: "Professional pitch deck ready for VCs", color: "#3b82f6" },
    { icon: Code2, label: "Implementation Plan", desc: "Tech architecture, sprint plan, launch checklist", color: "#8b5cf6" },
  ],
  de: [
    { icon: Lightbulb, label: "Ideenanalyse", desc: "SWOT-Analyse, Wertversprechen, Wettbewerbsvorteil", color: "#f59e0b" },
    { icon: DollarSign, label: "Finanzmodell", desc: "3-Jahres-Prognose, Break-even, Finanz-KPIs", color: "#10b981" },
    { icon: FileText, label: "Investorenvorschlag", desc: "Professionelles Pitch-Deck, bereit für VCs", color: "#3b82f6" },
    { icon: Code2, label: "Umsetzungsplan", desc: "Technische Architektur, Sprint-Plan, Launch-Checkliste", color: "#8b5cf6" },
  ],
};

const STR = {
  fa: {
    eyebrow: "ابزار جدید — استارتاپ‌سازی هوشمند",
    title: "استارتاپ خودت را با AIFekr بساز",
    desc: "از ایده تا پیاده‌سازی — هوش مصنوعی همه چیز را برایت می‌سازد. مدل مالی، پروپوزال سرمایه‌گذار و برنامه اجرایی در چند دقیقه.",
    cta: "شروع رایگان ←",
    badge: "هوشمند · حرفه‌ای · کامل",
  },
  en: {
    eyebrow: "New Tool — AI-Powered Startup Building",
    title: "Build Your Startup with AIFekr",
    desc: "From idea to implementation — AI generates everything for you. Financial model, investor proposal, and execution plan in minutes.",
    cta: "Start for Free →",
    badge: "Smart · Professional · Complete",
  },
  de: {
    eyebrow: "Neues Tool — KI-gestützter Startup-Aufbau",
    title: "Bau dein Startup mit AIFekr",
    desc: "Von der Idee bis zur Umsetzung — die KI erstellt alles für dich. Finanzmodell, Investorenvorschlag und Umsetzungsplan in wenigen Minuten.",
    cta: "Kostenlos starten →",
    badge: "Intelligent · Professionell · Vollständig",
  },
};

export default function StartupBuilderTeaser({ lang }: Props) {
  const s = STR[lang];
  const steps = STEPS[lang];
  const dir = lang === "fa" ? "rtl" : "ltr";

  return (
    <section
      className="py-24 px-6 relative overflow-hidden"
      dir={dir}
      style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.06) 0%, rgba(139,92,246,0.06) 50%, rgba(59,130,246,0.06) 100%)" }}
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(234,88,12,0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-10 left-10 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, #ea580c, transparent)" }}
      />
      <div
        className="absolute bottom-10 right-10 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Eyebrow */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(234,88,12,0.15)",
              color: "#f97316",
              border: "1px solid rgba(234,88,12,0.3)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {s.eyebrow}
          </span>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2
            className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #ea580c 50%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {s.title}
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
            {s.desc}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative group">
                {/* connector arrow */}
                {i < steps.length - 1 && (
                  <div
                    className="hidden lg:flex absolute top-8 items-center justify-center z-10"
                    style={{ [lang === "fa" ? "left" : "right"]: "-20px", width: "40px" }}
                  >
                    <ArrowRight
                      className="w-4 h-4 opacity-30"
                      style={{ color: "white", transform: lang === "fa" ? "rotate(180deg)" : "none" }}
                    />
                  </div>
                )}
                <div
                  className="p-5 rounded-2xl h-full transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${step.color}30`,
                    boxShadow: `0 0 0 0 ${step.color}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 30px ${step.color}25`)}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${step.color}20`, border: `1px solid ${step.color}40` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <div
                    className="text-xs font-bold mb-1 tracking-wider uppercase"
                    style={{ color: step.color }}
                  >
                    {lang === "fa" ? `مرحله ${["۱","۲","۳","۴"][i]}` : lang === "de" ? `Schritt ${i + 1}` : `Step ${i + 1}`}
                  </div>
                  <h3 className="font-bold mb-2 text-base" style={{ color: "white" }}>{step.label}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #ea580c, #f97316, #fb923c)",
              boxShadow: "0 0 40px rgba(234,88,12,0.4)",
            }}
          >
            <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            {s.cta}
          </Link>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{s.badge}</span>
        </div>
      </div>
    </section>
  );
}
