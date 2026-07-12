"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard, Play, Loader2, Stethoscope, FileText, Share2, Users,
  Brain, Plus, Trash2, Mail, DollarSign, Activity, Send, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Snapshot {
  businessDoctor: { totalAnalyses: number; latest: { businessName: string; industry: string; createdAt: string } | null };
  content: { totalPosts: number; latest: { title: string; publishedAt: string; externalStatus: string }[] };
  social: { totalPosts: number; latest: { platform: string; topic: string; createdAt: string }[] };
  sales: { totalContacts: number; needingFollowUp: { name: string; status: string; company: string | null }[] };
  data: { revenueLast30d: number; usageEventsLast30d: number; platformProviderIssuesLast30d: number };
}
interface Memory { id: string; category: string; text: string; source: string; createdAt: string; }
interface FollowUpDraft { contactId: string; name: string; phone: string | null; message: string; }

const CATEGORY_LABELS: Record<string, string> = { sales: "فروش", content: "محتوا", seo: "سئو", social: "شبکه اجتماعی", dev: "توسعه", general: "عمومی" };

export default function CeoOrchestratorPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [newMemCategory, setNewMemCategory] = useState("general");
  const [newMemText, setNewMemText] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [autoRunSaving, setAutoRunSaving] = useState(false);
  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => { loadSnapshot(); loadMemories(); loadAutoRun(); }, []);

  async function loadDrafts() {
    setDraftsLoading(true);
    try {
      const res = await fetch("/api/ceo/orchestrator/follow-up-drafts");
      if (res.ok) { const d = await res.json(); setDrafts(d.drafts || []); }
    } catch {}
    finally { setDraftsLoading(false); }
  }

  async function sendDraft(draft: FollowUpDraft) {
    if (!draft.phone) return;
    setSendingId(draft.contactId);
    try {
      const res = await fetch("/api/ceo/orchestrator/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: draft.contactId, message: draft.message }),
      });
      if (res.ok) setSentIds((prev) => new Set(prev).add(draft.contactId));
    } catch {}
    finally { setSendingId(null); }
  }

  async function loadAutoRun() {
    try {
      const res = await fetch("/api/ceo/orchestrator/auto-run");
      if (res.ok) { const d = await res.json(); setAutoRun(!!d.enabled); }
    } catch {}
  }

  async function toggleAutoRun() {
    const next = !autoRun;
    setAutoRunSaving(true);
    setAutoRun(next);
    try {
      await fetch("/api/ceo/orchestrator/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } catch {
      setAutoRun(!next);
    } finally {
      setAutoRunSaving(false);
    }
  }

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

  async function addMemory() {
    if (!newMemText.trim()) return;
    try {
      await fetch("/api/ceo/orchestrator/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newMemCategory, text: newMemText.trim() }),
      });
      setNewMemText("");
      loadMemories();
    } catch {}
  }

  async function deleteMemory(id: string) {
    try {
      await fetch("/api/ceo/orchestrator/memory", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  }

  async function runAnalysis() {
    setRunning(true);
    setError("");
    setAnalysis("");
    try {
      const res = await fetch("/api/ceo/orchestrator/run", { method: "POST" });
      if (!res.ok) { setError("خطا در ارتباط با سرور."); return; }
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
            if (evt.text) setAnalysis((prev) => prev + evt.text);
            if (evt.error) setError(evt.error);
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
      setError("خطا در ارتباط با سرور.");
    } finally {
      setRunning(false);
      loadMemories();
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
            <LayoutDashboard className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>هماهنگ‌کنندهٔ کسب‌وکار</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>وضعیت واقعی همهٔ ابزارها را جمع می‌کند و مدیرعامل هوش مصنوعی اولویت‌ها را مشخص می‌کند</p>
          </div>
        </div>

        {/* Snapshot cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Stethoscope className="w-4 h-4 mb-2" style={{ color: "#3b82f6" }} />
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{snapshot?.businessDoctor.totalAnalyses ?? "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>تحلیل دکتر کسب‌وکار</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <FileText className="w-4 h-4 mb-2" style={{ color: "#14b8a6" }} />
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{snapshot?.content.totalPosts ?? "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>مقاله منتشرشده</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Share2 className="w-4 h-4 mb-2" style={{ color: "#8b5cf6" }} />
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{snapshot?.social.totalPosts ?? "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>پست شبکه اجتماعی</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Users className="w-4 h-4 mb-2" style={{ color: "#f59e0b" }} />
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{snapshot?.sales.needingFollowUp.length ?? "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>مخاطب نیازمند پیگیری</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <DollarSign className="w-4 h-4 mb-2" style={{ color: "#22c55e" }} />
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{(snapshot?.data.revenueLast30d ?? 0).toLocaleString("fa-IR")} تومان</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>درآمد ۳۰ روز اخیر</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Activity className="w-4 h-4 mb-2" style={{ color: "#06b6d4" }} />
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{snapshot?.data.usageEventsLast30d ?? "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>فعالیت ثبت‌شده (۳۰ روز)</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Mail className="w-4 h-4 mb-2" style={{ color: autoRun ? "#22c55e" : "var(--text-muted)" }} />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>تحلیل خودکار روزانه + ایمیل</p>
              <button
                onClick={toggleAutoRun}
                disabled={autoRunSaving}
                className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                style={{ background: autoRun ? "var(--primary)" : "var(--surface-2)" }}
              >
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ [autoRun ? "right" : "left"]: 2 } as React.CSSProperties} />
              </button>
            </div>
          </div>
        </div>

        {/* Run analysis */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <button
            onClick={runAnalysis}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "در حال تحلیل..." : "تحلیل و اولویت‌بندی توسط مدیرعامل"}
          </button>
          {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
          {analysis && (
            <div className="prose prose-invert max-w-none text-sm leading-relaxed mt-5 pt-5" style={{ color: "var(--text-primary)", borderTop: "1px solid var(--border)" }}>
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sales follow-up drafts */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>پیش‌نویس پیگیری فروش</p>
            </div>
            <button
              onClick={loadDrafts}
              disabled={draftsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {draftsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              {draftsLoading ? "در حال نوشتن..." : "تولید پیش‌نویس‌ها"}
            </button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>روی «تولید پیش‌نویس‌ها» بزنید تا برای مخاطبان نیازمند پیگیری، پیام آماده بنویسیم</p>
          ) : (
            <ul>
              {drafts.map((d, i) => {
                const sent = sentIds.has(d.contactId);
                return (
                  <li key={d.contactId} className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{d.message}</p>
                      {!d.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>شماره تلفن ثبت نشده</p>}
                    </div>
                    <button
                      onClick={() => sendDraft(d)}
                      disabled={!d.phone || sent || sendingId === d.contactId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 disabled:opacity-50"
                      style={{ background: sent ? "rgba(34,197,94,0.15)" : "rgba(234,88,12,0.15)", color: sent ? "#22c55e" : "var(--primary)" }}
                    >
                      {sendingId === d.contactId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      {sent ? "ارسال شد" : "ارسال پیامک"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Shared memory */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Brain className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>حافظهٔ مشترک کسب‌وکار</p>
          </div>
          <div className="p-4 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <select
              value={newMemCategory}
              onChange={(e) => setNewMemCategory(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              value={newMemText}
              onChange={(e) => setNewMemText(e.target.value)}
              placeholder="یه نکته یا واقعیت مهم دربارهٔ کسب‌وکار اضافه کنید..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button onClick={addMemory} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> افزودن
            </button>
          </div>
          {memories.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>هنوز نکته‌ای ثبت نشده — بعد از اولین تحلیل، مدیرعامل این بخش را پر می‌کند</p>
          ) : (
            <ul>
              {memories.map((m, i) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
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
