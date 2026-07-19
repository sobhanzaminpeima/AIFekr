"use client";

import { useState, useEffect } from "react";
import { Rocket, Lightbulb, DollarSign, FileText, Code2, ChevronRight, Loader2, Plus, Trash2, RefreshCw, Download, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type Stage = "idea" | "financial" | "proposal" | "implementation";
type Lang = "fa" | "en";

interface Project {
  id: string;
  name: string;
  stage: Stage;
  ideaData: string | null;
  financialData: string | null;
  proposalData: string | null;
  implementationData: string | null;
  updatedAt: string;
}

const STAGES: { id: Stage; icon: React.ComponentType<{ className?: string }> ; labelFa: string; labelEn: string; color: string }[] = [
  { id: "idea", icon: Lightbulb, labelFa: "ایده و تحلیل", labelEn: "Idea & Analysis", color: "#f59e0b" },
  { id: "financial", icon: DollarSign, labelFa: "مدل مالی", labelEn: "Financial Model", color: "#10b981" },
  { id: "proposal", icon: FileText, labelFa: "پروپوزال سرمایه‌گذار", labelEn: "Investor Proposal", color: "#3b82f6" },
  { id: "implementation", icon: Code2, labelFa: "پیاده‌سازی", labelEn: "Implementation Plan", color: "#8b5cf6" },
];

const IDEA_FIELDS = {
  fa: [
    { key: "name", label: "نام استارتاپ", placeholder: "مثال: DigiFood" },
    { key: "description", label: "توضیح کوتاه", placeholder: "در یک جمله توضیح بده..." },
    { key: "problem", label: "مشکلی که حل می‌کنی", placeholder: "مشتری با چه مشکلی روبروست؟" },
    { key: "targetMarket", label: "بازار هدف", placeholder: "کدام افراد/شرکت‌ها مشتری شما هستند؟" },
    { key: "solution", label: "راه‌حل شما", placeholder: "محصول یا خدمت شما چیست؟" },
  ],
  en: [
    { key: "name", label: "Startup Name", placeholder: "e.g. DigiFood" },
    { key: "description", label: "Short Description", placeholder: "Describe in one sentence..." },
    { key: "problem", label: "Problem You Solve", placeholder: "What problem does your customer face?" },
    { key: "targetMarket", label: "Target Market", placeholder: "Who are your customers?" },
    { key: "solution", label: "Your Solution", placeholder: "What is your product or service?" },
  ],
};

const FINANCIAL_FIELDS = {
  fa: [
    { key: "businessModel", label: "مدل کسب‌وکار", placeholder: "مثال: SaaS ماهانه، کمیسیون، فریمیوم" },
    { key: "initialInvestment", label: "سرمایه‌گذاری اولیه", placeholder: "مثال: ۵۰۰ میلیون تومان" },
    { key: "monthlyRevenue", label: "درآمد ماهانه پیش‌بینی", placeholder: "در ماه اول تا سوم چقدر؟" },
    { key: "monthlyCosts", label: "هزینه‌های ماهانه", placeholder: "حقوق، سرور، بازاریابی..." },
    { key: "growthRate", label: "نرخ رشد ماهانه", placeholder: "مثال: ۱۵ درصد ماهانه" },
    { key: "teamSize", label: "اندازه تیم", placeholder: "مثال: ۴ نفر" },
  ],
  en: [
    { key: "businessModel", label: "Business Model", placeholder: "e.g. Monthly SaaS, Commission, Freemium" },
    { key: "initialInvestment", label: "Initial Investment", placeholder: "e.g. $50,000" },
    { key: "monthlyRevenue", label: "Projected Monthly Revenue", placeholder: "Month 1-3 estimate?" },
    { key: "monthlyCosts", label: "Monthly Costs", placeholder: "Salaries, servers, marketing..." },
    { key: "growthRate", label: "Monthly Growth Rate", placeholder: "e.g. 15% per month" },
    { key: "teamSize", label: "Team Size", placeholder: "e.g. 4 people" },
  ],
};

const PROPOSAL_FIELDS = {
  fa: [
    { key: "askAmount", label: "مبلغ مورد نیاز از سرمایه‌گذار", placeholder: "مثال: ۲ میلیارد تومان" },
    { key: "equity", label: "سهام پیشنهادی", placeholder: "مثال: ۱۵ درصد" },
    { key: "useOfFunds", label: "مصرف سرمایه", placeholder: "پول را کجا خرج می‌کنی؟" },
    { key: "founderBackground", label: "پیشینه مؤسسان", placeholder: "تیم کیست؟ چه تجربه‌ای دارند؟" },
  ],
  en: [
    { key: "askAmount", label: "Investment Ask", placeholder: "e.g. $200,000" },
    { key: "equity", label: "Equity Offered", placeholder: "e.g. 15%" },
    { key: "useOfFunds", label: "Use of Funds", placeholder: "Where will the money go?" },
    { key: "founderBackground", label: "Founder Background", placeholder: "Who is the team? What's their experience?" },
  ],
};

const IMPL_FIELDS = {
  fa: [
    { key: "techStack", label: "استک فنی ترجیحی", placeholder: "مثال: Next.js، PostgreSQL، AWS" },
    { key: "mvpFeatures", label: "ویژگی‌های MVP", placeholder: "مهم‌ترین ویژگی‌های نسخه اول" },
    { key: "launchTimeline", label: "جدول زمانی لانچ", placeholder: "مثال: ۳ ماه تا MVP" },
    { key: "teamRoles", label: "نقش‌های تیم", placeholder: "مثال: ۱ فرانت، ۱ بک‌اند، ۱ طراح" },
  ],
  en: [
    { key: "techStack", label: "Preferred Tech Stack", placeholder: "e.g. Next.js, PostgreSQL, AWS" },
    { key: "mvpFeatures", label: "MVP Features", placeholder: "Most important features for v1" },
    { key: "launchTimeline", label: "Launch Timeline", placeholder: "e.g. 3 months to MVP" },
    { key: "teamRoles", label: "Team Roles", placeholder: "e.g. 1 frontend, 1 backend, 1 designer" },
  ],
};

function getFieldsForStage(stage: Stage, lang: Lang) {
  if (stage === "idea") return IDEA_FIELDS[lang];
  if (stage === "financial") return FINANCIAL_FIELDS[lang];
  if (stage === "proposal") return PROPOSAL_FIELDS[lang];
  return IMPL_FIELDS[lang];
}

function getDataKey(stage: Stage): "ideaData" | "financialData" | "proposalData" | "implementationData" {
  const map: Record<Stage, "ideaData" | "financialData" | "proposalData" | "implementationData"> = {
    idea: "ideaData",
    financial: "financialData",
    proposal: "proposalData",
    implementation: "implementationData",
  };
  return map[stage];
}

export default function StartupBuilderPage() {
  const [lang, setLang] = useState<Lang>("fa");
  const dir = lang === "fa" ? "rtl" : "ltr";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeStage, setActiveStage] = useState<Stage>("idea");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [aiResult, setAiResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/startup");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { toast.error(lang === "fa" ? "خطا در بارگذاری" : "Load error"); }
    finally { setLoadingProjects(false); }
  }

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/startup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      setProjects((p) => [data.project, ...p]);
      setSelectedProject(data.project);
      setNewName("");
      setActiveStage("idea");
      setFormData({});
      setAiResult("");
      toast.success(lang === "fa" ? "پروژه ساخته شد" : "Project created");
    } catch { toast.error(lang === "fa" ? "خطا" : "Error"); }
    finally { setCreating(false); }
  }

  async function deleteProject(id: string) {
    if (!confirm(lang === "fa" ? "حذف شود؟" : "Delete?")) return;
    await fetch(`/api/startup/${id}`, { method: "DELETE" });
    setProjects((p) => p.filter((x) => x.id !== id));
    if (selectedProject?.id === id) { setSelectedProject(null); setAiResult(""); }
    toast.success(lang === "fa" ? "حذف شد" : "Deleted");
  }

  function selectProject(p: Project) {
    setSelectedProject(p);
    setActiveStage(p.stage as Stage || "idea");
    setAiResult("");
    // Load saved data for the stage
    const key = getDataKey(p.stage as Stage || "idea");
    const saved = p[key];
    if (saved) {
      try { setAiResult(JSON.parse(saved)?.result || ""); } catch {}
    }
    setFormData({});
  }

  async function generate() {
    if (!selectedProject) return;
    const fields = getFieldsForStage(activeStage, lang);
    const missing = fields.find((f) => !formData[f.key]?.trim());
    if (missing) {
      toast.error(lang === "fa" ? `لطفاً "${missing.label}" را وارد کنید` : `Please fill in "${missing.label}"`);
      return;
    }

    setLoading(true);
    setAiResult("");
    try {
      const res = await fetch("/api/startup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: activeStage, data: formData, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiResult(data.result);

      // Save result to project
      const dataKey = getDataKey(activeStage);
      await fetch(`/api/startup/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [dataKey]: JSON.stringify({ inputs: formData, result: data.result }), stage: activeStage }),
      });
      loadProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (lang === "fa" ? "خطا در تولید" : "Generation error"));
    } finally {
      setLoading(false);
    }
  }

  function downloadResult() {
    if (!aiResult || !selectedProject) return;
    const blob = new Blob([aiResult], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject.name}-${activeStage}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stageIndex = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {lang === "fa" ? "سازنده استارتاپ با AI" : "AI Startup Builder"}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {lang === "fa" ? "ایده → مالی → پروپوزال → پیاده‌سازی — همه با هوش مصنوعی" : "Idea → Financial → Proposal → Implementation — all with AI"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLang((l) => (l === "fa" ? "en" : "fa"))}
          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {lang === "fa" ? "English" : "فارسی"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar: Project list */}
        <div className="lg:col-span-1 space-y-3">
          <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {lang === "fa" ? "پروژه جدید" : "New Project"}
            </p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                placeholder={lang === "fa" ? "نام استارتاپ..." : "Startup name..."}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={createProject}
                disabled={creating || !newName.trim()}
                className="p-2 rounded-xl text-white disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {lang === "fa" ? "پروژه‌های من" : "My Projects"}
              </p>
              <button onClick={loadProjects} disabled={loadingProjects}>
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProjects ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            {projects.length === 0 && !loadingProjects && (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                {lang === "fa" ? "هنوز پروژه‌ای ندارید" : "No projects yet"}
              </p>
            )}
            {projects.map((p) => {
              const stageInfo = STAGES.find((s) => s.id === p.stage);
              return (
                <div
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className="p-3 rounded-xl cursor-pointer transition-all group"
                  style={{
                    background: selectedProject?.id === p.id ? "var(--surface-2)" : "var(--surface-1)",
                    border: `1px solid ${selectedProject?.id === p.id ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: stageInfo?.color || "#6b7280" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {lang === "fa" ? stageInfo?.labelFa : stageInfo?.labelEn}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center min-h-80 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
              <Rocket className="w-14 h-14 mb-4 opacity-20" style={{ color: "var(--primary)" }} />
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {lang === "fa" ? "یک پروژه انتخاب یا بسازید" : "Select or create a project"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {lang === "fa" ? "از پنل سمت راست یک پروژه جدید بسازید" : "Create a new project from the left panel"}
              </p>
            </div>
          ) : (
            <>
              {/* Stage tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STAGES.map((s, i) => {
                  const Icon = s.icon;
                  const isCompleted = i < stageIndex;
                  const isActive = s.id === activeStage;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setActiveStage(s.id); setAiResult(""); setFormData({}); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
                      style={{
                        background: isActive ? s.color : isCompleted ? "rgba(16,185,129,0.1)" : "var(--surface-1)",
                        color: isActive ? "white" : isCompleted ? "#10b981" : "var(--text-secondary)",
                        border: `1px solid ${isActive ? s.color : isCompleted ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                      }}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      {lang === "fa" ? s.labelFa : s.labelEn}
                    </button>
                  );
                })}
              </div>

              {/* Stage form */}
              <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  {(() => { const s = STAGES.find((x) => x.id === activeStage)!; const Icon = s.icon; return <div className="w-5 h-5" style={{ color: s.color }}><Icon className="w-5 h-5" /></div>; })()}
                  <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {lang === "fa" ? STAGES.find((s) => s.id === activeStage)?.labelFa : STAGES.find((s) => s.id === activeStage)?.labelEn}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFieldsForStage(activeStage, lang).map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
                      <input
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={generate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: STAGES.find((s) => s.id === activeStage)?.color || "var(--primary)" }}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> {lang === "fa" ? "در حال تولید با AI..." : "Generating with AI..."}</>
                  ) : (
                    <><Rocket className="w-5 h-5" /> {lang === "fa" ? "تولید با هوش مصنوعی" : "Generate with AI"} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>

              {/* AI Result */}
              {aiResult && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {lang === "fa" ? "نتیجه هوش مصنوعی" : "AI Result"}
                      </span>
                      <div className="flex gap-2">
                        {activeStage !== "implementation" && (
                          <button
                            onClick={() => {
                              const nextIdx = STAGES.findIndex((s) => s.id === activeStage) + 1;
                              if (nextIdx < STAGES.length) { setActiveStage(STAGES[nextIdx].id); setAiResult(""); setFormData({}); }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "var(--primary)" }}
                          >
                            {lang === "fa" ? "مرحله بعد" : "Next Stage"} <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={downloadResult}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {lang === "fa" ? "دانلود" : "Download"}
                        </button>
                      </div>
                    </div>
                    <div
                      className="p-5 text-sm leading-loose whitespace-pre-wrap max-h-[600px] overflow-y-auto font-mono"
                      style={{
                        background: "var(--surface-1)",
                        color: "var(--text-secondary)",
                        direction: lang === "fa" ? "rtl" : "ltr",
                        textAlign: lang === "fa" ? "right" : "left",
                        unicodeBidi: "plaintext",
                        fontFamily: "Vazirmatn, Tahoma, sans-serif",
                      }}
                    >
                      {aiResult}
                    </div>
                  </div>

                  {/* CTA after implementation stage */}
                  {activeStage === "implementation" && (
                    <div
                      className="p-6 rounded-2xl text-center space-y-4"
                      style={{
                        background: "linear-gradient(135deg, rgba(234,88,12,0.1), rgba(139,92,246,0.1))",
                        border: "1px solid rgba(234,88,12,0.3)",
                      }}
                    >
                      <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>
                          {lang === "fa"
                            ? "در صورت نیاز برای پیاده‌سازی استارتاپ توسط تیم حرفه‌ای و کامل AIFekr کلیک کنید"
                            : "Need professional implementation? Click to connect with the AIFekr team"}
                        </h3>
                        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                          {lang === "fa"
                            ? "تیم متخصص ما ایده شما را از صفر تا محصول کامل پیاده‌سازی می‌کند"
                            : "Our expert team takes your idea from zero to a complete product"}
                        </p>
                        <Link
                          href="/startup/contact"
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                          style={{ background: "linear-gradient(135deg,#ea580c,#f97316)", boxShadow: "0 0 30px rgba(234,88,12,0.4)" }}
                        >
                          <Rocket className="w-5 h-5" />
                          {lang === "fa" ? "درخواست پیاده‌سازی حرفه‌ای ←" : "Request Professional Implementation →"}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
