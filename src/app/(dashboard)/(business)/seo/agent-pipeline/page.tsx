"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import {
  Sparkles, Play, ChevronDown, Check, Loader2, X, Plus, Trash2,
  FileText, Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye, ExternalLink, Link2,
  Wand2, Image as ImageIcon, ShieldCheck, AlertTriangle, Info,
} from "lucide-react";
import ShareButton from "@/components/ui/ShareButton";

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (prompt: string, opts?: { model?: string }) => Promise<string>;
        txt2img: (prompt: string, opts?: { model?: string }) => Promise<HTMLImageElement>;
      };
    };
  }
}
import { trackFeature } from "@/lib/analytics";
import ReactMarkdown from "react-markdown";
import { toJalali } from "@/lib/utils/jalali";
import { useTranslation } from "@/lib/i18n";

type AgentKey = "ideaFinder" | "strategist" | "researcher" | "writer" | "editor" | "seo" | "publisher" | "critic";

const AGENT_ICONS: Record<AgentKey, any> = {
  ideaFinder: Lightbulb, strategist: Target, researcher: Search, writer: PenLine,
  editor: ClipboardCheck, seo: Globe2, publisher: Send, critic: Eye,
};
const AGENT_ORDER: AgentKey[] = ["ideaFinder", "strategist", "researcher", "writer", "editor", "seo", "publisher", "critic"];

interface StepState { output: string; status: "idle" | "running" | "done" | "failed"; score?: number; attempt: number; }
interface Lesson { id: string; agentKey: string; text: string; source: string; createdAt: string; }
interface Post {
  id: string; title: string; content: string; metaTitle: string; metaDescription: string; slug: string; keywords: string; publishedAt: string;
  externalStatus?: "not_published" | "published" | "failed" | "held_for_review"; externalUrl?: string | null; externalError?: string | null;
  heroImageUrl?: string | null;
}
interface SeoIssue { id: string; severity: "error" | "warning" | "info"; messageFa: string; messageEn: string; }
interface AuditResult { score: number; issues: SeoIssue[]; }
interface SeoConn { platform: string; siteUrl: string | null; wpUsername: string | null; hasAppPassword: boolean }

export default function AgentPipelinePage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const s = t.agentPipelinePage;

  const AGENTS = AGENT_ORDER.map((key) => ({ key, nameFa: s.agents[key].name, roleFa: s.agents[key].role, icon: AGENT_ICONS[key] }));

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
  const [runId, setRunId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Blog images + AI SEO audit ────────────────────────────────────────
  const [puterReady, setPuterReady] = useState(false);
  const [imageGeneratingId, setImageGeneratingId] = useState<string | null>(null);
  const [galleryPickerFor, setGalleryPickerFor] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [audits, setAudits] = useState<Record<string, AuditResult>>({});
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);

  async function generatePostImage(post: Post) {
    if (!window.puter) return;
    setImageGeneratingId(post.id);
    try {
      const prompt = isFa
        ? `یک تصویر شاخص (hero image) حرفه‌ای برای مقاله وبلاگ با عنوان «${post.title}»، سبک بصری تمیز و مدرن، مناسب برای انتشار در سایت، بدون هیچ متنی روی تصویر.`
        : `A professional hero/featured image for a blog article titled "${post.title}", clean modern visual style, suitable for a website, no text on the image.`;
      const imgEl = await window.puter.ai.txt2img(prompt, { model: "gpt-image-1-mini" });
      const blob = await (await fetch(imgEl.src)).blob();
      const uploadForm = new FormData();
      uploadForm.append("file", new File([blob], "hero.png", { type: blob.type || "image/png" }));
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);
      await saveHeroImage(post.id, uploadData.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setImageGeneratingId(null);
    }
  }

  async function saveHeroImage(postId: string, heroImageUrl: string) {
    try {
      const res = await fetch("/api/seo/agent-pipeline/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, heroImageUrl }),
      });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, heroImageUrl } : p)));
      }
    } catch {}
  }

  async function openGalleryForPost(postId: string) {
    setGalleryPickerFor(postId);
    setGalleryLoading(true);
    try {
      const r = await fetch("/api/gallery?type=image", { credentials: "include" });
      const d = await r.json();
      setGalleryImages(d.items || []);
    } catch {}
    finally { setGalleryLoading(false); }
  }

  async function runAudit(postId: string) {
    setAuditingId(postId);
    try {
      const res = await fetch("/api/seo/agent-pipeline/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        const d = await res.json();
        setAudits((prev) => ({ ...prev, [postId]: d }));
      }
    } catch {}
    finally { setAuditingId(null); }
  }

  async function fixIssuesAndReaudit(postId: string) {
    setFixingId(postId);
    try {
      const res = await fetch("/api/seo/agent-pipeline/audit/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAudits((prev) => ({ ...prev, [postId]: { score: d.score, issues: d.issues } }));
      if (d.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: d.post.content, metaTitle: d.post.metaTitle, metaDescription: d.post.metaDescription } : p)));
        setPreviewPost((prev) => (prev && prev.id === postId ? { ...prev, content: d.post.content, metaTitle: d.post.metaTitle, metaDescription: d.post.metaDescription } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setFixingId(null);
    }
  }

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
    setRunId(null);
    trackFeature("content_pipeline", { topic });

    try {
      const res = await fetch("/api/seo/agent-pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, brandVoice }),
      });
      if (!res.ok) { setError(t.common.error); setRunning(false); return; }

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
      setError(t.common.error);
    } finally {
      setRunning(false);
      loadLessons();
      loadPosts();
    }
  }

  function handleEvent(evt: any) {
    if (evt.type === "runId") {
      setRunId(evt.id);
    } else if (evt.type === "agentStart") {
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
    <div dir={isFa ? "rtl" : "ltr"} className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setPuterReady(true)} />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
            <Sparkles className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[
            { key: "run", label: s.tabRun },
            { key: "lessons", label: `${s.tabLessons} (${lessons.length})` },
            { key: "posts", label: `${s.tabPosts} (${posts.length})` },
          ].map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key as typeof tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === tb.key ? "var(--primary)" : "var(--surface-1)",
                color: tab === tb.key ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "run" && (
          <>
            <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.topicLabel}</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={running}
                    placeholder={s.topicPlaceholder}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{s.brandVoiceLabel}</label>
                  <input
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    disabled={running}
                    placeholder={s.brandVoicePlaceholder}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: seoConn?.siteUrl ? "#22c55e" : "var(--text-muted)" }} />
                {seoConn?.platform === "wordpress" && seoConn.siteUrl ? (
                  <span style={{ color: "var(--text-secondary)" }}>{s.connectedPrefix} <strong>{seoConn.siteUrl}</strong> {s.connectedSuffix}</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>
                    {s.notConnected}{" "}
                    <a href="/seo" className="underline" style={{ color: "var(--primary)" }}>{s.connectWordpress}</a>
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
                {running ? s.runningBtn : s.startBtn}
              </button>
              {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
              {publishInfo && (
                <p className="mt-3 text-sm flex items-center gap-1.5" style={{ color: publishInfo.status === "published" ? "#22c55e" : publishInfo.status === "failed" ? "#ef4444" : "var(--text-muted)" }}>
                  {publishInfo.status === "published" && publishInfo.url && (
                    <>
                      <Check className="w-4 h-4" /> {s.publishedSuccess}{" "}
                      <a href={publishInfo.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                        {s.viewOnSite} <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                  {publishInfo.status === "failed" && <>{s.publishFailed} {publishInfo.error}</>}
                  {publishInfo.status === "not_published" && <>{s.notPublished}</>}
                  {publishInfo.status === "held_for_review" && <>⚠️ {publishInfo.error}</>}
                </p>
              )}
              {!running && runId && (
                <div className="mt-3 flex items-center gap-2">
                  <ShareButton type="content-pipeline" id={runId} />
                </div>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                {s.researchNote}
              </p>
            </div>

            <div className="space-y-3">
              {AGENTS.map((a) => {
                const st = steps[a.key];
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
                            background: st.status === "done" ? "rgba(34,197,94,0.15)" : st.status === "running" ? "rgba(234,88,12,0.15)" : st.status === "failed" ? "rgba(239,68,68,0.15)" : "var(--surface-2)",
                          }}
                        >
                          {st.status === "running" ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                          ) : st.status === "done" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : st.status === "failed" ? (
                            <X className="w-4 h-4 text-red-500" />
                          ) : (
                            <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {a.nameFa} {st.attempt > 1 && <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>({s.attempt} {st.attempt})</span>}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.roleFa}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {st.score != null && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: st.score >= 75 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: st.score >= 75 ? "#22c55e" : "#ef4444" }}
                          >
                            {st.score}/100
                          </span>
                        )}
                        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        {st.output ? (
                          <div className="prose prose-sm prose-invert max-w-none rounded-xl p-4 text-xs leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                            <ReactMarkdown>{st.output}</ReactMarkdown>
                            <div ref={st.status === "running" ? scrollRef : undefined} />
                          </div>
                        ) : (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>{s.notRunYet}</p>
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
              <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>{s.addLessonManual}</p>
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
                  placeholder={s.addLessonPlaceholder}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={addLesson}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--primary)" }}
                >
                  <Plus className="w-4 h-4" /> {s.addBtn}
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
                            {l.source === "critic" ? s.criticSource : s.youSource}
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
              <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{s.noLessonsYet}</p>
            )}
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-3">
            {posts.length === 0 && (
              <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{s.noPostsYet}</p>
            )}
            {posts.map((post) => (
              <div key={post.id} className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {post.heroImageUrl ? (
                      <img src={post.heroImageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    )}
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{post.title}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{post.metaDescription}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? toJalali(post.publishedAt) : new Date(post.publishedAt).toLocaleDateString("en-US")}</p>
                        {post.externalStatus === "published" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{s.publishedBadge}</span>
                        )}
                        {post.externalStatus === "failed" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{s.publishFailedBadge}</span>
                        )}
                        {post.externalStatus === "held_for_review" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "rgba(234,179,8,0.15)", color: "#eab308" }} title={post.externalError || ""}>
                            {isFa ? "نیازمند بازبینی" : "Needs review"}
                          </span>
                        )}
                        {audits[post.id] && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: audits[post.id].score >= 80 ? "rgba(34,197,94,0.15)" : audits[post.id].score >= 60 ? "rgba(234,179,8,0.15)" : "rgba(239,68,68,0.15)",
                              color: audits[post.id].score >= 80 ? "#22c55e" : audits[post.id].score >= 60 ? "#eab308" : "#ef4444",
                            }}
                          >
                            {isFa ? "امتیاز سئو" : "SEO score"}: {audits[post.id].score}
                          </span>
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
                        <ExternalLink className="w-3.5 h-3.5" /> {s.siteBtn}
                      </a>
                    )}
                    <button
                      onClick={() => setPreviewPost(post)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
                    >
                      {s.viewBtn}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  {!post.heroImageUrl && (
                    <>
                      <button
                        onClick={() => generatePostImage(post)}
                        disabled={imageGeneratingId === post.id || !puterReady}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px dashed var(--border)" }}
                      >
                        {imageGeneratingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        {isFa ? "طراحی تصویر شاخص با AI" : "Design hero image with AI"}
                      </button>
                      <button
                        onClick={() => openGalleryForPost(post.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px dashed var(--border)" }}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {isFa ? "انتخاب از گالری" : "Choose from gallery"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => runAudit(post.id)}
                    disabled={auditingId === post.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}
                  >
                    {auditingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {isFa ? "بررسی سئو" : "Run SEO audit"}
                  </button>
                </div>

                {audits[post.id] && audits[post.id].issues.length > 0 && (
                  <>
                    <ul className="mt-3 space-y-1.5">
                      {audits[post.id].issues.map((issue) => (
                        <li key={issue.id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {issue.severity === "error" ? (
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                          ) : issue.severity === "warning" ? (
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#eab308" }} />
                          ) : (
                            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          )}
                          <span>{isFa ? issue.messageFa : issue.messageEn}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => fixIssuesAndReaudit(post.id)}
                      disabled={fixingId === post.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 mt-3"
                      style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                    >
                      {fixingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {fixingId === post.id
                        ? (isFa ? "در حال رفع مشکلات..." : "Fixing issues...")
                        : (isFa ? "رفع خودکار مشکلات و بررسی مجدد" : "Auto-fix issues & re-audit")}
                    </button>
                  </>
                )}
                {audits[post.id] && audits[post.id].issues.length === 0 && (
                  <p className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: "#22c55e" }}>
                    <Check className="w-3.5 h-3.5" /> {isFa ? "هیچ مشکل سئویی پیدا نشد." : "No SEO issues found."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {galleryPickerFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setGalleryPickerFor(null)}>
            <div
              className="max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "انتخاب تصویر شاخص" : "Choose Hero Image"}</h2>
                <button onClick={() => setGalleryPickerFor(null)} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
              </div>
              {galleryLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /></div>
              ) : galleryImages.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "گالری خالی است." : "Gallery is empty."}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={async () => {
                        await saveHeroImage(galleryPickerFor, img.url);
                        setGalleryPickerFor(null);
                      }}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-orange-500 transition-all"
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
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
