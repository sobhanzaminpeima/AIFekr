"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Play, ChevronDown, Check, Loader2, X, Plus, Trash2,
  FileText, Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye, ExternalLink, Link2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type AgentKey = "ideaFinder" | "strategist" | "researcher" | "writer" | "editor" | "seo" | "publisher" | "critic";

const AGENTS: { key: AgentKey; nameFa: string; roleFa: string; icon: any }[] = [
  { key: "ideaFinder", nameFa: "ایده‌یاب", roleFa: "پیدا کردن ایده‌های مقاله", icon: Lightbulb },
  { key: "strategist", nameFa: "استراتژیست محتوا", roleFa: "انتخاب بهترین ایده", icon: Target },
  { key: "researcher", nameFa: "پژوهشگر", roleFa: "بررسی فکت‌ها و سوالات رایج", icon: Search },
  { key: "writer", nameFa: "نویسنده", roleFa: "نگارش پیش‌نویس کامل", icon: PenLine },
  { key: "editor", nameFa: "ویراستار", roleFa: "امتیازدهی و بازبینی متن", icon: ClipboardCheck },
  { key: "seo", nameFa: "متخصص سئو", roleFa: "بهینه‌سازی برای موتور جستجو", icon: Globe2 },
  { key: "publisher", nameFa: "ناشر", roleFa: "انتشار مقاله تایید‌شده", icon: Send },
  { key: "critic", nameFa: "منتقد", roleFa: "نقد پست و ثبت درس‌ها", icon: Eye },
];

interface StepState { output: string; status: "idle" | "running" | "done" | "failed"; score?: number; attempt: number; }
interface Lesson { id: string; agentKey: string; text: string; source: string; createdAt: string; }
interface Post {
  id: string; title: string; content: string; metaTitle: string; metaDescription: string; slug: string; keywords: string; publishedAt: string;
  externalStatus?: "not_published" | "published" | "failed"; externalUrl?: string | null; externalError?: string | null;
}
interface SeoConn { platform: string; siteUrl: string | null; wpUsername: string | null; hasAppPassword: boolean }

export default function AgentPipelinePage() {
  const [topic, setTopic] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<AgentKey, StepState>>(() =>
    Object.fromEntries(AGENTS.map((a) => [a.key, { output: "", status: "idle" as const, attempt: 1 }])) as Record<AgentKey, StepState>
  );
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<AgentKey | null>(null);
  const [tab, setTab] = useState<"run" | "lessons" | "posts">("run");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newLessonAgent, setNewLessonAgent] = useState<AgentKey>("writer");
  const [newLessonText, setNewLessonText] = useState("");
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [seoConn, setSeoConn] = useState<SeoConn | null>(null);
  const [publishInfo, setPublishInfo] = useState<{ status: string; url: string | null; error: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadLessons(); loadPosts(); loadConnection(); }, []);

  async function loadConnection() {
    try {
      const res = await fetch("/api/seo/connection");
      if (res.ok) { const d = await res.json(); setSeoConn(d.connection); }
    } catch {}
  }

  async function loadLessons() {
    try {
      const res = await fetch("/api/seo/agent-pipeline/lessons");
      if (res.ok) { const d = await res.json(); setLessons(d.lessons || []); }
    } catch {}
  }

  async function loadPosts() {
    try {
      const res = await fetch("/api/seo/agent-pipeline/posts");
      if (res.ok) { const d = await res.json(); setPosts(d.posts || []); }
    } catch {}
  }

  async function addLesson() {
    if (!newLessonText.trim()) return;
    try {
      const res = await fetch("/api/seo/agent-pipeline/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: newLessonAgent, text: newLessonText.trim() }),
      });
      if (res.ok) { setNewLessonText(""); loadLessons(); }
    } catch {}
  }

  async function deleteLesson(id: string) {
    try {
      await fetch("/api/seo/agent-pipeline/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch {}
  }

  async function start() {
    if (!topic.trim() || running) return;
    setRunning(true);
    setError("");
    setSteps(Object.fromEntries(AGENTS.map((a) => [a.key, { output: "", status: "idle" as const, attempt: 1 }])) as Record<AgentKey, StepState>);
    setExpanded(null);
    setPublishInfo(null);

    try {
      const res = await fetch("/api/seo/agent-pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, brandVoice }),
      });
      if (!res.ok) { setError("خطا در ارتباط با سرور."); setRunning(false); return; }

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
          try {
            const evt = JSON.parse(line.slice(6));
            handleEvent(evt);
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
      setError("خطا در ارتباط با سرور.");
    } finally {
      setRunning(false);
      loadLessons();
      loadPosts();
    }
  }

  function handleEvent(evt: any) {
    if (evt.type === "agentStart") {
      setExpanded(evt.agentKey);
      setSteps((prev) => ({ ...prev, [evt.agentKey]: { output: "", status: "running", attempt: evt.attempt } }));
    } else if (evt.type === "agentChunk") {
      setSteps((prev) => ({ ...prev, [evt.agentKey]: { ...prev[evt.agentKey as AgentKey], output: prev[evt.agentKey as AgentKey].output + evt.text } }));
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (evt.type === "agentDone") {
      setSteps((prev) => ({ ...prev, [evt.agentKey]: { output: evt.output, status: "done", score: evt.score, attempt: evt.attempt } }));
    } else if (evt.type === "publishResult") {
      setPublishInfo({ status: evt.status, url: evt.url, error: evt.error });
    } else if (evt.type === "error") {
      setError(evt.message);
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
            <Sparkles className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>خط تولید محتوای هوشمند</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>۸ agent تخصصی که با هم یک مقاله کامل تولید و منتشر می‌کنند</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[
            { key: "run", label: "اجرا" },
            { key: "lessons", label: `درس‌ها (${lessons.length})` },
            { key: "posts", label: `پست‌ها (${posts.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === t.key ? "var(--primary)" : "var(--surface-1)",
                color: tab === t.key ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "run" && (
          <>
            <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>موضوع یا صنعت کسب‌وکار *</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={running}
                    placeholder="مثال: کلینیک دندانپزشکی، فروشگاه لوازم آشپزخانه، آژانس مسافرتی..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>لحن برند (اختیاری)</label>
                  <input
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    disabled={running}
                    placeholder="مثال: دوستانه و صمیمی، رسمی و تخصصی..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: seoConn?.siteUrl ? "#22c55e" : "var(--text-muted)" }} />
                {seoConn?.platform === "wordpress" && seoConn.siteUrl ? (
                  <span style={{ color: "var(--text-secondary)" }}>مقاله پس از تایید، مستقیماً در <strong>{seoConn.siteUrl}</strong> منتشر می‌شود</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>
                    هیچ سایتی متصل نیست — مقاله فقط داخل AiFekr ذخیره می‌شود.{" "}
                    <a href="/seo" className="underline" style={{ color: "var(--primary)" }}>اتصال وردپرس را در صفحهٔ سئو تنظیم کنید</a>
                  </span>
                )}
              </div>

              <button
                onClick={start}
                disabled={!topic.trim() || running}
                className="mt-4 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? "در حال اجرا..." : "شروع"}
              </button>
              {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
              {publishInfo && (
                <p className="mt-3 text-sm flex items-center gap-1.5" style={{ color: publishInfo.status === "published" ? "#22c55e" : publishInfo.status === "failed" ? "#ef4444" : "var(--text-muted)" }}>
                  {publishInfo.status === "published" && publishInfo.url && (
                    <>
                      <Check className="w-4 h-4" /> با موفقیت منتشر شد —{" "}
                      <a href={publishInfo.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                        مشاهده در سایت <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                  {publishInfo.status === "failed" && <>انتشار در سایت ناموفق بود: {publishInfo.error}</>}
                  {publishInfo.status === "not_published" && <>فقط داخل AiFekr ذخیره شد (سایتی متصل نیست)</>}
                </p>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                توجه: agent پژوهشگر از جستجوی زندهٔ وب (Tavily) استفاده می‌کند و منابع را ذکر می‌کند — با این حال، فکت‌های حساس را پیش از انتشار راستی‌آزمایی کنید.
              </p>
            </div>

            <div className="space-y-3">
              {AGENTS.map((a) => {
                const s = steps[a.key];
                const isOpen = expanded === a.key;
                const Icon = a.icon;
                return (
                  <div key={a.key} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : a.key)}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{
                            background: s.status === "done" ? "rgba(34,197,94,0.15)" : s.status === "running" ? "rgba(234,88,12,0.15)" : s.status === "failed" ? "rgba(239,68,68,0.15)" : "var(--surface-2)",
                          }}
                        >
                          {s.status === "running" ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                          ) : s.status === "done" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : s.status === "failed" ? (
                            <X className="w-4 h-4 text-red-500" />
                          ) : (
                            <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {a.nameFa} {s.attempt > 1 && <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(تلاش {s.attempt})</span>}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.roleFa}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.score != null && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: s.score >= 75 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: s.score >= 75 ? "#22c55e" : "#ef4444" }}
                          >
                            {s.score}/100
                          </span>
                        )}
                        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        {s.output ? (
                          <div className="prose prose-sm prose-invert max-w-none rounded-xl p-4 text-xs leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                            <ReactMarkdown>{s.output}</ReactMarkdown>
                            <div ref={s.status === "running" ? scrollRef : undefined} />
                          </div>
                        ) : (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>هنوز اجرا نشده</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "lessons" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>افزودن نکته دستی برای یک agent</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value={newLessonAgent}
                  onChange={(e) => setNewLessonAgent(e.target.value as AgentKey)}
                  className="px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  {AGENTS.map((a) => <option key={a.key} value={a.key}>{a.nameFa}</option>)}
                </select>
                <input
                  value={newLessonText}
                  onChange={(e) => setNewLessonText(e.target.value)}
                  placeholder="مثلاً: جمله‌ها را کوتاه‌تر و فعل‌محور بنویس"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={addLesson}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--primary)" }}
                >
                  <Plus className="w-4 h-4" /> افزودن
                </button>
              </div>
            </div>

            {AGENTS.map((a) => {
              const agentLessons = lessons.filter((l) => l.agentKey === a.key);
              if (agentLessons.length === 0) return null;
              return (
                <div key={a.key} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.nameFa}</p>
                  </div>
                  <ul>
                    {agentLessons.map((l, i) => (
                      <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                        <div className="flex items-start gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5"
                            style={{ background: l.source === "critic" ? "rgba(139,92,246,0.15)" : "rgba(20,184,166,0.15)", color: l.source === "critic" ? "#8b5cf6" : "#14b8a6" }}
                          >
                            {l.source === "critic" ? "منتقد" : "شما"}
                          </span>
                          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{l.text}</p>
                        </div>
                        <button onClick={() => deleteLesson(l.id)} className="p-1 rounded-lg flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {lessons.length === 0 && (
              <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>هنوز درسی ثبت نشده — بعد از اولین اجرا، agent منتقد این بخش را پر می‌کند</p>
            )}
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-3">
            {posts.length === 0 && (
              <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>هنوز مقاله‌ای منتشر نشده</p>
            )}
            {posts.map((post) => (
              <div key={post.id} className="rounded-2xl p-5 flex items-start justify-between gap-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{post.title}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{post.metaDescription}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(post.publishedAt).toLocaleDateString("fa-IR")}</p>
                      {post.externalStatus === "published" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>منتشرشده در سایت</span>
                      )}
                      {post.externalStatus === "failed" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>انتشار خارجی ناموفق</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {post.externalUrl && (
                    <a
                      href={post.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> سایت
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewPost(post)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
                  >
                    مشاهده
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setPreviewPost(null)}>
            <div
              className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{previewPost.title}</h2>
                <button onClick={() => setPreviewPost(null)} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
              </div>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                <ReactMarkdown>{previewPost.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
