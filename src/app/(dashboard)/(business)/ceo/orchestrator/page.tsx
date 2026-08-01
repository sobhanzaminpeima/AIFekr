"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain, Play, Loader2, Stethoscope, FileText, Share2, Users,
  Plus, Trash2, Mail, DollarSign, Activity, Send, Check,
  CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp,
  Zap, Shield, Target, BarChart3, RefreshCw, ChevronRight,
  Briefcase, Search, ShoppingCart, Building2, Cpu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/jalali";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  businessDoctor: { totalAnalyses: number; latest: { businessName: string; industry: string; createdAt: string } | null };
  content: { totalPosts: number; latest: { title: string }[] };
  social: { totalPosts: number; latest: { platform: string; topic: string }[] };
  sales: { totalContacts: number; needingFollowUp: { name: string; status: string; company: string | null }[] };
  data: { revenueLast30d: number; usageEventsLast30d: number; platformProviderIssuesLast30d: number };
}
interface Memory { id: string; category: string; text: string; source: string; createdAt: string; }
interface FollowUpDraft { contactId: string; name: string; phone: string | null; message: string; }
interface CeoTask { id: string; title: string; department: string; priority: string; status: string; requiresApproval: boolean; estimatedImpact: string | null; createdAt: string; }
interface DeptReport { dept: string; deptLabel: string; status: "critical" | "warning" | "good"; score: number; headline: string; problems: string[]; opportunities: string[]; }
interface BoardroomSession { id: string; status: string; healthScore: number | null; summary: string | null; departments: DeptReport[]; createdAt: string; }

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiBosPage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const s = t.ceoOrchestratorPage;
  const dateLocale = isFa ? "fa-IR" : "en-US";

  const DEPT_META: Record<string, { icon: React.ElementType; color: string; labelFa: string }> = {
    marketing:  { icon: TrendingUp,  color: "#10b981", labelFa: s.departments.marketing },
    seo:        { icon: Search,      color: "#3b82f6", labelFa: s.departments.seo },
    sales:      { icon: ShoppingCart,color: "#8b5cf6", labelFa: s.departments.sales },
    finance:    { icon: DollarSign,  color: "#f59e0b", labelFa: s.departments.finance },
    operations: { icon: Cpu,         color: "#ef4444", labelFa: s.departments.operations },
  };

  const PRIORITY_META: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  label: s.priorities.critical },
    high:     { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: s.priorities.high },
    medium:   { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", label: s.priorities.medium },
    low:      { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: s.priorities.low },
  };

  const STATUS_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    pending:  { color: "#f59e0b", icon: Clock,        label: s.statuses.pending },
    approved: { color: "#10b981", icon: CheckCircle2, label: s.statuses.approved },
    rejected: { color: "#ef4444", icon: XCircle,      label: s.statuses.rejected },
    done:     { color: "#6b7280", icon: Check,         label: s.statuses.done },
  };

  const CATEGORY_LABELS: Record<string, string> = s.categories;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tasks, setTasks] = useState<CeoTask[]>([]);
  const [lastSession, setLastSession] = useState<BoardroomSession | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [running, setRunning] = useState(false);
  const [boardroomRunning, setBoardroomRunning] = useState(false);
  const [boardroomLog, setBoardroomLog] = useState<string[]>([]);
  const [boardroomDepts, setBoardroomDepts] = useState<DeptReport[]>([]);
  const [boardroomHealth, setBoardroomHealth] = useState<number | null>(null);
  const [boardroomSynthesis, setBoardroomSynthesis] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [newMemCategory, setNewMemCategory] = useState("general");
  const [newMemText, setNewMemText] = useState("");
  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState("all");

  useEffect(() => {
    loadSnapshot();
    loadMemories();
    loadAutoRun();
    loadTasks();
    loadLastSession();
  }, []);

  async function loadSnapshot() {
    try {
      const res = await fetch("/api/ceo/orchestrator/snapshot");
      if (res.ok) setSnapshot(await res.json());
    } catch {}
  }

  async function loadMemories() {
    try {
      const res = await fetch("/api/ceo/orchestrator/memory");
      if (res.ok) { const d = await res.json(); setMemories(d.memories || []); }
    } catch {}
  }

  async function loadTasks() {
    try {
      const res = await fetch("/api/ceo/tasks");
      if (res.ok) { const d = await res.json(); setTasks(d.tasks || []); }
    } catch {}
  }

  async function loadLastSession() {
    try {
      const res = await fetch("/api/ceo/boardroom");
      if (res.ok) {
        const d = await res.json();
        if (d.session) setLastSession(d.session);
      }
    } catch {}
  }

  async function loadAutoRun() {
    try {
      const res = await fetch("/api/ceo/orchestrator/auto-run");
      if (res.ok) { const d = await res.json(); setAutoRun(!!d.enabled); }
    } catch {}
  }

  async function toggleAutoRun() {
    const next = !autoRun;
    setAutoRun(next);
    await fetch("/api/ceo/orchestrator/auto-run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => setAutoRun(!next));
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch("/api/ceo/tasks", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setTasks((prev) => prev.map((tk) => tk.id === id ? { ...tk, status } : tk));
  }

  async function deleteTask(id: string) {
    await fetch("/api/ceo/tasks", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTasks((prev) => prev.filter((tk) => tk.id !== id));
  }

  async function addMemory() {
    if (!newMemText.trim()) return;
    await fetch("/api/ceo/orchestrator/memory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newMemCategory, text: newMemText.trim() }),
    });
    setNewMemText("");
    loadMemories();
  }

  async function deleteMemory(id: string) {
    await fetch("/api/ceo/orchestrator/memory", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function runCeoAnalysis() {
    setRunning(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/ceo/orchestrator/run", { method: "POST" });
      if (!res.ok) return;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.text) setAnalysis((p) => p + evt.text);
          } catch {}
        }
      }
    } finally {
      setRunning(false);
      loadMemories();
    }
  }

  async function runBoardroom() {
    setBoardroomRunning(true);
    setBoardroomLog([]);
    setBoardroomDepts([]);
    setBoardroomHealth(null);
    setBoardroomSynthesis("");

    try {
      const res = await fetch("/api/ceo/boardroom", { method: "POST" });
      if (!res.ok) return;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "snapshot_ready") setBoardroomLog((p) => [...p, s.logSnapshotReady]);
            if (evt.type === "departments_start") setBoardroomLog((p) => [...p, s.logDeptsStart]);
            if (evt.type === "dept_start") setBoardroomLog((p) => [...p, `⚙️ ${evt.deptLabel} ${s.logDeptAnalyzing}`]);
            if (evt.type === "dept_done") {
              setBoardroomDepts((p) => [...p, evt.report]);
              setBoardroomLog((pl) => [...pl, `✅ ${evt.report.deptLabel} ${s.logDeptDone} ${evt.report.score}/100`]);
            }
            if (evt.type === "health_score") setBoardroomHealth(evt.score);
            if (evt.type === "synthesis_start") setBoardroomLog((p) => [...p, s.logSynthesisStart]);
            if (evt.type === "synthesis_chunk") setBoardroomSynthesis((p) => p + evt.text);
            if (evt.type === "done") {
              setBoardroomLog((p) => [...p, `${s.logSessionDone} ${evt.taskCount} ${s.logTasksCreated}`]);
              loadTasks();
              loadLastSession();
            }
          } catch {}
        }
      }
    } finally {
      setBoardroomRunning(false);
    }
  }

  async function loadDrafts() {
    setDraftsLoading(true);
    try {
      const res = await fetch("/api/ceo/orchestrator/follow-up-drafts");
      if (res.ok) { const d = await res.json(); setDrafts(d.drafts || []); }
    } finally { setDraftsLoading(false); }
  }

  async function sendDraft(draft: FollowUpDraft) {
    if (!draft.phone) return;
    setSendingId(draft.contactId);
    try {
      const res = await fetch("/api/ceo/orchestrator/sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: draft.contactId, message: draft.message }),
      });
      if (res.ok) setSentIds((p) => new Set(p).add(draft.contactId));
    } finally { setSendingId(null); }
  }

  const healthScore = boardroomHealth ?? lastSession?.healthScore ?? null;
  const depts = boardroomDepts.length > 0 ? boardroomDepts : (lastSession?.departments ?? []);
  const synthesis = boardroomSynthesis || lastSession?.summary || "";
  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter((tk) => tk.status === taskFilter);
  const pendingApproval = tasks.filter((tk) => tk.requiresApproval && tk.status === "pending");

  return (
    <div className="min-h-screen" dir={isFa ? "rtl" : "ltr"} style={{ background: "var(--surface-0)" }}>
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(234,88,12,0.2),rgba(139,92,246,0.2))", border: "1px solid rgba(234,88,12,0.3)" }}>
              <Brain className="w-6 h-6" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>AI-BOS</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingApproval.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {formatNumber(pendingApproval.length, lang)} {s.pendingApprovals}
              </span>
            )}
            <button
              onClick={() => { loadSnapshot(); loadTasks(); loadLastSession(); }}
              className="p-2 rounded-xl" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ─── Row 1: KPIs + Health Score ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Health Score */}
          <div className="lg:col-span-2 rounded-2xl p-5 flex items-center gap-6"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            {healthScore !== null
              ? <HealthRing score={healthScore} />
              : (
                <div className="w-36 h-36 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: "8px solid var(--surface-2)" }}>
                  <span className="text-sm text-center px-2" style={{ color: "var(--text-muted)" }}>{s.runBoardroomFirst}</span>
                </div>
              )
            }
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{s.businessHealth}</p>
              <p className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {healthScore !== null
                  ? healthScore >= 70 ? s.healthy : healthScore >= 40 ? s.needsAttention : s.critical
                  : "—"}
              </p>
              {lastSession && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.lastSession} {new Date(lastSession.createdAt).toLocaleDateString(dateLocale)}
                </p>
              )}
              <button
                onClick={runBoardroom}
                disabled={boardroomRunning}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,var(--primary),#8b5cf6)" }}
              >
                {boardroomRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {boardroomRunning ? s.boardroomRunning : s.runBoardroom}
              </button>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiTile icon={DollarSign} color="#22c55e" label={s.kpiRevenue30d} value={(snapshot?.data.revenueLast30d ?? 0).toLocaleString(dateLocale) + (isFa ? " ت" : "")} />
            <KpiTile icon={Users} color="#8b5cf6" label={s.kpiSalesFollowup} value={snapshot?.sales.needingFollowUp.length ?? "—"} />
            <KpiTile icon={Target} color="#f59e0b" label={s.kpiActiveTasks} value={tasks.filter((tk) => tk.status === "pending").length} />
            <KpiTile icon={Activity} color="#3b82f6" label={s.kpiActivity} value={snapshot?.data.usageEventsLast30d ?? "—"} />
          </div>
        </div>

        {/* ─── Boardroom Live / Last Session ───────────────────────────────── */}
        {(boardroomRunning || depts.length > 0) && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Building2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {boardroomRunning ? s.boardroomLiveTitle : s.boardroomLastTitle}
              </span>
              {boardroomRunning && <Loader2 className="w-4 h-4 animate-spin mr-auto" style={{ color: "var(--primary)" }} />}
            </div>

            {/* Live log */}
            {boardroomRunning && boardroomLog.length > 0 && (
              <div className="px-5 py-3 space-y-1" style={{ borderBottom: "1px solid var(--border)" }}>
                {boardroomLog.map((l, i) => (
                  <p key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>{l}</p>
                ))}
              </div>
            )}

            {/* Department cards */}
            {depts.length > 0 && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {depts.map((d) => {
                  const meta = DEPT_META[d.dept] || { icon: Briefcase, color: "#6b7280", labelFa: d.deptLabel };
                  const DeptIcon = meta.icon;
                  const statusColor = d.status === "critical" ? "#ef4444" : d.status === "warning" ? "#f59e0b" : "#10b981";
                  return (
                    <div key={d.dept} className="rounded-xl p-3"
                      style={{ background: "var(--surface-2)", border: `1px solid ${statusColor}30` }}>
                      <div className="flex items-center justify-between mb-2">
                        <DeptIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                        <span className="text-xs font-bold" style={{ color: statusColor }}>{d.score}</span>
                      </div>
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>{meta.labelFa}</p>
                      <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{d.headline}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CEO Synthesis */}
            {synthesis && (
              <div className="px-5 pb-5">
                <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
                  <ReactMarkdown>{synthesis}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Active Tasks ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.aiTasksTitle}</span>
              {tasks.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  {formatNumber(tasks.length, lang)}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {["all", "pending", "approved", "done"].map((fk) => (
                <button key={fk} onClick={() => setTaskFilter(fk)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    background: taskFilter === fk ? "var(--primary)" : "var(--surface-2)",
                    color: taskFilter === fk ? "white" : "var(--text-muted)",
                  }}>
                  {{ all: s.filterAll, pending: s.filterPending, approved: s.filterApproved, done: s.filterDone }[fk]}
                </button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
              {tasks.length === 0 ? s.noTasksYet : s.noTasksInCategory}
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredTasks.map((task) => {
                const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                const sm = STATUS_META[task.status] || STATUS_META.pending;
                const StatusIcon = sm.icon;
                const deptMeta = DEPT_META[task.department];
                return (
                  <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: pm.bg, color: pm.color }}>
                          {pm.label}
                        </span>
                        {deptMeta && (
                          <span className="text-[10px]" style={{ color: deptMeta.color }}>
                            {deptMeta.labelFa}
                          </span>
                        )}
                        {task.requiresApproval && task.status === "pending" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                            {s.needsApproval}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                      {task.estimatedImpact && (
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>💡 {task.estimatedImpact}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <StatusIcon className="w-3.5 h-3.5" style={{ color: sm.color }} />
                      {task.status === "pending" && (
                        <>
                          <button onClick={() => updateTaskStatus(task.id, "approved")}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => updateTaskStatus(task.id, "rejected")}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {task.status === "approved" && (
                        <button onClick={() => updateTaskStatus(task.id, "done")}
                          className="p-1.5 rounded-lg text-xs"
                          style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-muted)" }}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── CEO Daily Analysis ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.dailyAnalysisTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.autoDailyAnalysis}</span>
              <button onClick={toggleAutoRun}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: autoRun ? "var(--primary)" : "var(--surface-2)" }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ [autoRun ? "right" : "left"]: 2 } as React.CSSProperties} />
              </button>
            </div>
          </div>
          <div className="p-5">
            <button onClick={runCeoAnalysis} disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? s.runningAnalysis : s.runAnalysis}
            </button>
            {analysis && (
              <div className="prose prose-sm max-w-none mt-5 pt-5 text-sm" style={{ color: "var(--text-primary)", borderTop: "1px solid var(--border)" }}>
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* ─── Sales Follow-up ──────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.salesFollowupTitle}</span>
              {snapshot?.sales.needingFollowUp.length ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                  {formatNumber(snapshot.sales.needingFollowUp.length, lang)} {s.contactsSuffix}
                </span>
              ) : null}
            </div>
            <button onClick={loadDrafts} disabled={draftsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {draftsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {s.generateMessages}
            </button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              {s.generateMessagesHint}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {drafts.map((d) => {
                const sent = sentIds.has(d.contactId);
                return (
                  <li key={d.contactId} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{d.message}</p>
                      {!d.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{s.noPhoneRegistered}</p>}
                    </div>
                    <button onClick={() => sendDraft(d)} disabled={!d.phone || sent || sendingId === d.contactId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 disabled:opacity-50"
                      style={{ background: sent ? "rgba(34,197,94,0.12)" : "rgba(234,88,12,0.12)", color: sent ? "#22c55e" : "var(--primary)" }}>
                      {sendingId === d.contactId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      {sent ? s.sent : s.sendBtn}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ─── Company Memory ────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Brain className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.companyMemoryTitle}</span>
            {memories.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                {formatNumber(memories.length, lang)}
              </span>
            )}
          </div>
          <div className="p-4 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <select value={newMemCategory} onChange={(e) => setNewMemCategory(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={newMemText} onChange={(e) => setNewMemText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}
              placeholder={s.memoryPlaceholder}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={addMemory}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> {s.addBtn}
            </button>
          </div>
          {memories.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              {s.noMemoryYet}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {memories.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 flex-shrink-0"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                      {CATEGORY_LABELS[m.category] || m.category}
                    </span>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{m.text}</p>
                  </div>
                  <button onClick={() => deleteMemory(m.id)} className="p-1 rounded-lg flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <Icon className="w-4 h-4 mb-2" style={{ color }} />
      <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
