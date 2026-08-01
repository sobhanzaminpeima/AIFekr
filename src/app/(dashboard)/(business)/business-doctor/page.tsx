"use client";

import { useState, useRef, useEffect } from "react";
import {
  Stethoscope, Building2, Send, ChevronRight, ChevronLeft,
  CheckCircle, Edit2, Users, TrendingUp, Target, Zap,
  MessageSquare, Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import ShareButton from "@/components/ui/ShareButton";
import { trackFeature } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n";

interface BusinessProfile {
  name: string;
  industry: string;
  website?: string;
  size?: string;
  revenue?: string;
  description?: string;
  products?: string;
  targetCustomers?: string;
  competitors?: string;
  goals?: string;
  challenges?: string;
  strengths?: string;
  businessModel?: string;
  uniqueValue?: string;
  foundedYear?: string;
}

export default function BusinessDoctorPage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const s = t.businessDoctorPage;

  const INDUSTRIES = s.industries;
  const STEPS = [
    { id: 1, title: s.stepBasicTitle, icon: Building2, desc: s.stepBasicDesc },
    { id: 2, title: s.stepMarketTitle, icon: TrendingUp, desc: s.stepMarketDesc },
    { id: 3, title: s.stepGoalsTitle, icon: Target, desc: s.stepGoalsDesc },
  ];

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BusinessProfile>({
    name: "", industry: "", website: "", size: "", revenue: "",
    description: "", products: "", targetCustomers: "", competitors: "",
    goals: "", challenges: "", strengths: "", businessModel: "", uniqueValue: "", foundedYear: "",
  });

  // AI Analysis state
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showQuickAnalysis, setShowQuickAnalysis] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/business-profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setProfile(d.profile);
          setForm(d.profile);
        } else {
          setEditMode(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  function updateForm(key: keyof BusinessProfile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    if (!form.name || !form.industry) return;
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setProfile(form);
        setEditMode(false);
        setStep(1);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function askDoctor(q?: string) {
    const finalQ = q || question;
    if (!finalQ.trim()) return;
    setAnalyzing(true);
    setResult("");
    setAnalysisId(null);
    trackFeature("business_doctor");

    try {
      const res = await fetch("/api/business-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQ }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const p = JSON.parse(data);
            if (p.text) setResult((prev) => prev + p.text);
            if (p.analysisId) setAnalysisId(p.analysisId);
            if (p.error) throw new Error(p.error);
          } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
        }
      }
    } catch (e) { console.error(e); }
    finally { setAnalyzing(false); }
  }

  const QUICK_QUESTIONS = s.quickQuestions;

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface-0)" }}>
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }} dir={isFa ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
              <Stethoscope className="w-6 h-6" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {profile ? `${s.profilePrefix} ${profile.name} — ${s.profileSuffix}` : s.subtitleNoProfile}
              </p>
            </div>
          </div>
          {profile && !editMode && (
            <div className="flex gap-2">
              <Link href="/meeting"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                <Users className="w-4 h-4" />
                {s.meetingRoom}
              </Link>
              <button onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                <Edit2 className="w-4 h-4" />
                {s.editProfile}
              </button>
            </div>
          )}
        </div>

        {/* === EDIT / WIZARD MODE === */}
        {editMode && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            {/* Step progress */}
            <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
              {STEPS.map((st) => {
                const Icon = st.icon;
                const active = step === st.id;
                const done = step > st.id;
                return (
                  <button key={st.id} onClick={() => step > st.id && setStep(st.id)}
                    className="flex-1 flex flex-col items-center gap-1 py-4 text-xs transition-all"
                    style={{
                      background: active ? "rgba(234,88,12,0.1)" : "transparent",
                      borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
                      color: active ? "var(--primary)" : done ? "#10b981" : "var(--text-muted)",
                    }}>
                    {done ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Icon className="w-5 h-5" />}
                    <span className="font-medium">{st.title}</span>
                    <span className="hidden md:block" style={{ color: "var(--text-muted)", fontSize: "11px" }}>{st.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{s.basicInfoHeading}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.businessNameLabel}</label>
                      <input value={form.name} onChange={(e) => updateForm("name", e.target.value)}
                        placeholder={s.businessNamePlaceholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.industryLabel}</label>
                      <select value={form.industry} onChange={(e) => updateForm("industry", e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <option value="">{s.selectIndustry}</option>
                        {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.foundedYearLabel}</label>
                      <input value={form.foundedYear} onChange={(e) => updateForm("foundedYear", e.target.value)}
                        placeholder={s.foundedYearPlaceholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.teamSizeLabel}</label>
                      <select value={form.size} onChange={(e) => updateForm("size", e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <option value="">{s.selectOption}</option>
                        <option>{s.teamSize1}</option>
                        <option>{s.teamSize2to5}</option>
                        <option>{s.teamSize6to15}</option>
                        <option>{s.teamSize16to50}</option>
                        <option>{s.teamSize50to200}</option>
                        <option>{s.teamSize200plus}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.monthlyRevenueLabel}</label>
                      <input value={form.revenue} onChange={(e) => updateForm("revenue", e.target.value)}
                        placeholder={s.revenuePlaceholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.websiteLabel}</label>
                      <input value={form.website} onChange={(e) => updateForm("website", e.target.value)}
                        placeholder={s.websitePlaceholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.descriptionLabel}</label>
                      <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)}
                        placeholder={s.descriptionPlaceholder}
                        rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Products & Market */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{s.marketHeading}</h2>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.productsLabel}</label>
                    <textarea value={form.products} onChange={(e) => updateForm("products", e.target.value)}
                      placeholder={s.productsPlaceholder}
                      rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.targetCustomersLabel}</label>
                    <textarea value={form.targetCustomers} onChange={(e) => updateForm("targetCustomers", e.target.value)}
                      placeholder={s.targetCustomersPlaceholder}
                      rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.competitorsLabel}</label>
                    <textarea value={form.competitors} onChange={(e) => updateForm("competitors", e.target.value)}
                      placeholder={s.competitorsPlaceholder}
                      rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.businessModelLabel}</label>
                    <textarea value={form.businessModel} onChange={(e) => updateForm("businessModel", e.target.value)}
                      placeholder={s.businessModelPlaceholder}
                      rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.uniqueValueLabel}</label>
                    <textarea value={form.uniqueValue} onChange={(e) => updateForm("uniqueValue", e.target.value)}
                      placeholder={s.uniqueValuePlaceholder}
                      rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                </div>
              )}

              {/* Step 3: Situation & Goals */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{s.goalsHeading}</h2>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.challengesLabel}</label>
                    <textarea value={form.challenges} onChange={(e) => updateForm("challenges", e.target.value)}
                      placeholder={s.challengesPlaceholder}
                      rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.strengthsLabel}</label>
                    <textarea value={form.strengths} onChange={(e) => updateForm("strengths", e.target.value)}
                      placeholder={s.strengthsPlaceholder}
                      rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.goals12MoLabel}</label>
                    <textarea value={form.goals} onChange={(e) => updateForm("goals", e.target.value)}
                      placeholder={s.goalsPlaceholder}
                      rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex gap-2">
                  {step > 1 && (
                    <button onClick={() => setStep(step - 1)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      <ChevronRight className="w-4 h-4" />
                      {s.prev}
                    </button>
                  )}
                  {profile && (
                    <button onClick={() => { setEditMode(false); setStep(1); }}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {s.cancel}
                    </button>
                  )}
                </div>
                {step < 3 ? (
                  <button onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.name || !form.industry)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--primary)" }}>
                    {s.next}
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={saveProfile} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--primary)" }}>
                    {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{s.savingText}</> : <><CheckCircle className="w-4 h-4" />{s.saveActivate}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === PROFILE VIEW + AI DOCTOR === */}
        {profile && !editMode && (
          <>
            {/* Profile Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: s.industryStat, value: profile.industry, icon: Building2 },
                { label: s.teamSizeStat, value: profile.size || "—", icon: Users },
                { label: s.monthlyRevenueStat, value: profile.revenue || "—", icon: TrendingUp },
                { label: s.statusStat, value: s.active, icon: Zap },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Knowledge Base Summary */}
            <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.knowledgeBaseTitle}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>{s.active}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  { label: s.kbProducts, value: profile.products },
                  { label: s.kbTargetCustomers, value: profile.targetCustomers },
                  { label: s.kbUniqueValue, value: profile.uniqueValue },
                  { label: s.kbChallenges, value: profile.challenges },
                  { label: s.kbGoals, value: profile.goals },
                  { label: s.kbCompetitors, value: profile.competitors },
                ].map((item) => item.value && (
                  <div key={item.label} className="flex gap-2">
                    <span className="flex-shrink-0 text-xs font-medium w-28" style={{ color: "var(--text-muted)" }}>{item.label}:</span>
                    <span className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                {s.kbNote}
              </p>
            </div>

            {/* AI Doctor Chat */}
            <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.askTitle}</h2>
              </div>

              {/* Quick questions */}
              {!showQuickAnalysis && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => { setQuestion(q); setShowQuickAnalysis(true); askDoctor(q); }}
                      className="text-right px-3 py-2.5 rounded-xl text-xs transition-all hover:border-orange-500"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setShowQuickAnalysis(true); askDoctor(); }}}
                  placeholder={s.questionPlaceholder}
                  rows={2}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button onClick={() => { setShowQuickAnalysis(true); askDoctor(); }} disabled={analyzing || !question.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 flex-shrink-0"
                  style={{ background: "var(--primary)" }}>
                  {analyzing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div ref={resultRef} className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.analysisTitle}</h2>
                  {analyzing && <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />}
                </div>
                <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
                {!analyzing && (
                  <div className="mt-4 pt-4 flex flex-wrap gap-2 items-center" style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => { setResult(""); setQuestion(""); setShowQuickAnalysis(false); setAnalysisId(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                      {s.newQuestion}
                    </button>
                    <Link href="/meeting"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                      <Users className="w-3.5 h-3.5" />
                      {s.discussInMeeting}
                    </Link>
                    {analysisId && (
                      <ShareButton type="business-analysis" id={analysisId} />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
