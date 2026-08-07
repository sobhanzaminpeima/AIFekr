"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Script from "next/script";
import { Share2, Copy, Check, Calendar, Camera, Zap, Loader2, Image as ImageIcon, Upload, Wand2, X, TrendingUp, Users, Heart, MessageCircle, Sparkles, ExternalLink, PenLine, ChevronLeft, Clock, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";
import { toJalali } from "@/lib/utils/jalali";
import JalaliDateTimePicker from "@/components/ui/JalaliDateTimePicker";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

const PLATFORMS = ["LinkedIn", "Twitter/X", "Facebook", "TikTok"];

export default function SocialPage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const TONES = [
    { value: "Professional", label: t.social.tones.professional },
    { value: "Casual", label: t.social.tones.casual },
    { value: "Funny", label: t.social.tones.funny },
    { value: "Inspirational", label: t.social.tones.inspirational },
    { value: "Educational", label: t.social.tones.educational },
  ];

  const [form, setForm] = useState({
    brandName: "",
    topic: "",
    platform: "LinkedIn",
    tone: "Professional",
    hashtags: true,
    emojis: true,
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Instagram automation ──────────────────────────────────────────────
  const [igConnected, setIgConnected] = useState(false);
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [canAuto, setCanAuto] = useState(false);
  const [posts, setPosts] = useState<Array<{ id: string; caption: string; hashtags: string; imageUrl: string | null; scheduledFor: string; mode: string; status: string; errorMessage?: string | null }>>([]);
  const [igGenerating, setIgGenerating] = useState(false);
  const [igCaption, setIgCaption] = useState("");
  const [igHashtags, setIgHashtags] = useState<string[]>([]);
  const [igBestTime, setIgBestTime] = useState("");
  const [igImageUrl, setIgImageUrl] = useState("");
  const [igScheduledFor, setIgScheduledFor] = useState("");
  const [igMode, setIgMode] = useState<"auto" | "manual">("manual");
  const [scheduling, setScheduling] = useState(false);

  // ── In-page image gallery picker (replaces pasting a raw URL) ───────────
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  async function openGalleryPicker() {
    setShowGalleryPicker(true);
    setGalleryLoading(true);
    try {
      const r = await fetch("/api/gallery?type=image", { credentials: "include" });
      const d = await r.json();
      setGalleryImages(d.items || []);
    } catch {
      toast.error(t.common.error);
    } finally {
      setGalleryLoading(false);
    }
  }

  // ── Recreate from a sample post ────────────────────────────────────────
  const [puterReady, setPuterReady] = useState(false);
  const [refImageUrl, setRefImageUrl] = useState("");
  const [refUploading, setRefUploading] = useState(false);
  const [aiImageGenerating, setAiImageGenerating] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [recreateStep, setRecreateStep] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const igSectionRef = useRef<HTMLDivElement>(null);

  // ── Instagram creation wizard ──────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [creationMode, setCreationMode] = useState<"ai" | "recreate" | "manual" | "calendar" | null>(null);
  const [manualHashtagsInput, setManualHashtagsInput] = useState("");
  const [scheduleChoice, setScheduleChoice] = useState<"now" | "scheduled">("scheduled");

  // ── 7-day content calendar ──────────────────────────────────────────────
  const [calendarGenerating, setCalendarGenerating] = useState(false);
  const [calendarDays, setCalendarDays] = useState<{ dayOffset: number; date: Date; caption: string; hashtags: string[]; scheduling: boolean; scheduled: boolean }[] | null>(null);

  async function generateCalendar() {
    if (!form.brandName || !form.topic) return toast.error(t.common.error);
    setCalendarGenerating(true);
    setCalendarDays(null);
    try {
      const r = await fetch("/api/social/instagram/generate-calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: form.brandName, businessType: form.platform, topic: form.topic, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const today = new Date();
      const days = (d.posts || []).map((p: { dayOffset: number; caption: string; hashtags: string[] }) => {
        const date = new Date(today);
        date.setDate(date.getDate() + 1 + p.dayOffset);
        date.setHours(19, 0, 0, 0);
        return { dayOffset: p.dayOffset, date, caption: p.caption, hashtags: p.hashtags, scheduling: false, scheduled: false };
      });
      setCalendarDays(days);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
    } finally {
      setCalendarGenerating(false);
    }
  }

  function updateCalendarDay(dayOffset: number, patch: Partial<{ caption: string; date: Date }>) {
    setCalendarDays((prev) => prev && prev.map((d) => (d.dayOffset === dayOffset ? { ...d, ...patch } : d)));
  }

  async function scheduleCalendarDay(dayOffset: number) {
    const day = calendarDays?.find((d) => d.dayOffset === dayOffset);
    if (!day) return;
    setCalendarDays((prev) => prev && prev.map((d) => (d.dayOffset === dayOffset ? { ...d, scheduling: true } : d)));
    try {
      const pad = (n: number) => String(n).padStart(2, "0");
      const scheduledFor = `${day.date.getFullYear()}-${pad(day.date.getMonth() + 1)}-${pad(day.date.getDate())}T${pad(day.date.getHours())}:${pad(day.date.getMinutes())}`;
      const r = await fetch("/api/social/instagram/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: day.caption, hashtags: day.hashtags, imageUrl: null, scheduledFor, mode: "manual" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCalendarDays((prev) => prev && prev.map((dd) => (dd.dayOffset === dayOffset ? { ...dd, scheduling: false, scheduled: true } : dd)));
      loadIgStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.common.error);
      setCalendarDays((prev) => prev && prev.map((d) => (d.dayOffset === dayOffset ? { ...d, scheduling: false } : d)));
    }
  }

  async function scheduleAllCalendarDays() {
    if (!calendarDays) return;
    for (const day of calendarDays) {
      if (!day.scheduled) await scheduleCalendarDay(day.dayOffset);
    }
  }

  function resetWizard() {
    setWizardStep(1);
    setCreationMode(null);
    setIgCaption(""); setIgHashtags([]); setIgImageUrl(""); setIgScheduledFor(""); setIgBestTime("");
    setRefImageUrl(""); setStyleDescription(""); setManualHashtagsInput(""); setCalendarDays(null);
  }

  function goToImageStep() {
    setWizardStep(2);
  }

  // ── Page analytics & growth ──────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<{
    igUsername: string | null;
    current: { followersCount: number; mediaCount: number } | null;
    trend: { date: string; followersCount: number; mediaCount: number }[];
    recentMedia: { id: string; caption: string | null; mediaType: string; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string; timestamp: string; likeCount: number; commentsCount: number }[];
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [aiReport, setAiReport] = useState("");
  const [aiReportLoading, setAiReportLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const r = await fetch("/api/social/instagram/analytics", { credentials: "include" });
      const d = await r.json();
      if (r.ok) setAnalytics(d);
    } catch {}
    finally { setAnalyticsLoading(false); }
  }, []);

  async function generateAiReport() {
    setAiReportLoading(true);
    setAiReport("");
    try {
      const r = await fetch("/api/social/instagram/analytics/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAiReport(d.report || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAiReportLoading(false);
    }
  }

  const loadIgStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/social/instagram/status", { credentials: "include" });
      const d = await r.json();
      setIgConnected(!!d.connected);
      setIgUsername(d.igUsername);
      setCanAuto(!!d.canAutoPublish);
      setPosts(d.posts || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadIgStatus();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("instagram");
    if (status === "connected") toast.success(t.social.igConnected);
    if (status === "failed") toast.error(t.common.error);
    if (status === "no-ig-account") toast.error(t.common.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIgStatus]);

  useEffect(() => {
    if (igConnected) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igConnected]);

  async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRefImageUrl(data.url);
      setStyleDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setRefUploading(false);
      if (refFileInputRef.current) refFileInputRef.current.value = "";
    }
  }

  async function recreateFromReference() {
    if (!refImageUrl) return toast.error(t.common.error);
    if (!window.puter) return toast.error(lang === "fa" ? "اتصال به Puter برقرار نشد — کمی صبر کن و دوباره امتحان کن" : "Puter isn't ready yet — wait a moment and retry");
    setRecreating(true);
    setStyleDescription("");
    try {
      setRecreateStep(lang === "fa" ? "در حال تحلیل سبک تصویر..." : "Analyzing image style...");
      const analyzeRes = await fetch("/api/social/instagram/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: refImageUrl, businessName: form.brandName, businessType: form.platform, language: lang }),
      });
      const analysis = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analysis.error);
      setStyleDescription(analysis.styleDescription || "");

      setRecreateStep(lang === "fa" ? "در حال ساخت تصویر جدید..." : "Generating new image...");
      const imgEl = await window.puter.ai.txt2img(analysis.imagePrompt, { model: "gpt-image-1-mini" });

      setRecreateStep(lang === "fa" ? "در حال آپلود تصویر..." : "Uploading image...");
      const blob = await (await fetch(imgEl.src)).blob();
      const uploadForm = new FormData();
      uploadForm.append("file", new File([blob], "recreated.png", { type: blob.type || "image/png" }));
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      setIgImageUrl(uploadData.url);
      setIgCaption(analysis.caption || "");
      setIgHashtags(analysis.hashtags || []);
      toast.success(lang === "fa" ? "تصویر و کپشن جدید آماده شد" : "New image and caption are ready");
      setWizardStep(3); // image already produced by the recreate step — skip straight to scheduling
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setRecreating(false);
      setRecreateStep("");
    }
  }

  async function generateImageFromTopic() {
    if (!form.brandName || !form.topic) return toast.error(t.common.error);
    if (!window.puter) return toast.error(lang === "fa" ? "اتصال به Puter برقرار نشد — کمی صبر کن و دوباره امتحان کن" : "Puter isn't ready yet — wait a moment and retry");
    setAiImageGenerating(true);
    try {
      const prompt = lang === "fa"
        ? `یک عکس حرفه‌ای و جذاب برای پست اینستاگرام کسب‌وکار «${form.brandName}» با موضوع «${form.topic}»، سبک بصری ${form.tone}، مناسب شبکه‌های اجتماعی، بدون هیچ متنی روی تصویر.`
        : `A professional, eye-catching Instagram post image for the business "${form.brandName}" about "${form.topic}", ${form.tone} visual style, social-media ready, no text on the image.`;
      const imgEl = await window.puter.ai.txt2img(prompt, { model: "gpt-image-1-mini" });
      const blob = await (await fetch(imgEl.src)).blob();
      const uploadForm = new FormData();
      uploadForm.append("file", new File([blob], "ai-generated.png", { type: blob.type || "image/png" }));
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);
      setIgImageUrl(uploadData.url);
      toast.success(lang === "fa" ? "عکس ساخته شد" : "Image generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAiImageGenerating(false);
    }
  }

  async function generateIgPost() {
    if (!form.brandName || !form.topic) return toast.error(t.common.error);
    setIgGenerating(true);
    try {
      const r = await fetch("/api/social/instagram/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: form.brandName, businessType: form.platform, topic: form.topic, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setIgCaption(d.caption || "");
      setIgHashtags(d.hashtags || []);
      setIgBestTime(d.bestTime || "");
      setWizardStep(2);
    } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
    finally { setIgGenerating(false); }
  }

  function confirmManualContent() {
    if (!igCaption.trim()) return toast.error(t.common.error);
    const tags = manualHashtagsInput.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`));
    setIgHashtags(tags);
    setWizardStep(2);
  }

  async function schedulePost(overrides?: { scheduledFor?: string; mode?: "auto" | "manual" }) {
    const scheduledFor = overrides?.scheduledFor ?? igScheduledFor;
    const mode = overrides?.mode ?? igMode;
    if (!igCaption || !scheduledFor) return toast.error(t.common.error);
    setScheduling(true);
    try {
      const r = await fetch("/api/social/instagram/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: igCaption, hashtags: igHashtags, imageUrl: igImageUrl || null, scheduledFor, mode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(t.common.save);
      resetWizard();
      loadIgStatus();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
    finally { setScheduling(false); }
  }

  async function publishNow(postId: string) {
    try {
      const r = await fetch("/api/social/instagram/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(t.social.igPublishedStatus);
      loadIgStatus();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.common.error); }
  }

  async function generate(type: "posts" | "calendar") {
    const setter = type === "calendar" ? setCalendarLoading : setLoading;
    setter(true);
    setResult("");

    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type, language: lang }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const p = JSON.parse(data);
            if (p.text) setResult((prev) => prev + p.text);
          } catch {}
        }
      }
    } catch (err) { console.error(err); }
    finally { setter(false); }
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setPuterReady(true)} />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Share2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t.social.title}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.social.description}</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.social.brandName}</label>
              <input
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder={t.social.brandNamePlaceholder}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.social.topic}</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder={t.social.topicPlaceholder}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.social.platform}</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm({ ...form, platform: p })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.platform === p ? "var(--primary)" : "var(--surface-2)",
                      color: form.platform === p ? "white" : "var(--text-secondary)",
                      border: form.platform === p ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.social.tone}</label>
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {TONES.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hashtags}
                  onChange={(e) => setForm({ ...form, hashtags: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.social.hashtags}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emojis}
                  onChange={(e) => setForm({ ...form, emojis: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.social.emojis}</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => generate("posts")}
              disabled={!form.brandName || !form.topic || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Share2 className="w-4 h-4" />}
              {loading ? t.social.generating : t.social.generate}
            </button>
            <button
              onClick={() => generate("calendar")}
              disabled={!form.brandName || !form.topic || calendarLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {calendarLoading ? <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
              {t.social.calendar}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.social.resultTitle}</h2>
              <button
                onClick={copyResult}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t.social.copied : t.social.copyPost}
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Instagram automation — step wizard */}
        <div ref={igSectionRef} className="rounded-2xl p-6 mt-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" style={{ color: "#e1306c" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.social.igTitle}</h2>
            </div>
            {igConnected && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)" }}>
                {t.social.igConnected}: @{igUsername}
              </span>
            )}
          </div>

          {!igConnected ? (
            /* Step 0: connect gate */
            <div className="text-center py-10">
              <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                {isFa ? "برای ساخت و انتشار پست، اول اینستاگرامت رو وصل کن." : "Connect your Instagram account first to create and publish posts."}
              </p>
              <a href="/api/social/instagram/connect" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#e1306c" }}>
                {t.social.igConnectButton}
              </a>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center gap-2 flex-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: wizardStep >= n ? "#e1306c" : "var(--surface-2)",
                        color: wizardStep >= n ? "white" : "var(--text-muted)",
                      }}
                    >
                      {wizardStep > n ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    {n < 4 && <div className="h-0.5 flex-1" style={{ background: wizardStep > n ? "#e1306c" : "var(--border)" }} />}
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium mb-4" style={{ color: "var(--text-muted)" }}>
                {wizardStep === 1 && (isFa ? "۱. روش ساخت پست" : "1. Choose how to create the post")}
                {wizardStep === 2 && (isFa ? "۲. تصویر پست" : "2. Post image")}
                {wizardStep === 3 && (isFa ? "۳. زمان‌بندی انتشار" : "3. Publish timing")}
                {wizardStep === 4 && (isFa ? "۴. تایید نهایی" : "4. Final review")}
              </p>

              {/* Step 1: creation mode */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  {!creationMode && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <button onClick={() => setCreationMode("ai")}
                        className="p-4 rounded-xl text-right flex flex-col items-start gap-2 transition-all hover:opacity-90"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <Zap className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "تولید با AI" : "Generate with AI"}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "کپشن و هشتگ از روی برند و موضوع" : "Caption + hashtags from your brand & topic"}</span>
                      </button>
                      <button onClick={() => setCreationMode("recreate")}
                        className="p-4 rounded-xl text-right flex flex-col items-start gap-2 transition-all hover:opacity-90"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <Wand2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "بازآفرینی از نمونه" : "Recreate from a sample"}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "آپلود یک پست قبلی، ساخت مشابه آن" : "Upload a past post, build something similar"}</span>
                      </button>
                      <button onClick={() => setCreationMode("manual")}
                        className="p-4 rounded-xl text-right flex flex-col items-start gap-2 transition-all hover:opacity-90"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <PenLine className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "نوشتن دستی" : "Write manually"}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "کپشن و هشتگ خودت رو بنویس" : "Write your own caption and hashtags"}</span>
                      </button>
                      <button onClick={() => setCreationMode("calendar")}
                        className="p-4 rounded-xl text-right flex flex-col items-start gap-2 transition-all hover:opacity-90"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <Calendar className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "تقویم محتوایی ۷ روزه" : "7-day content calendar"}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "یک هفته پست، هر روز یک ایده" : "A week of posts, a different idea each day"}</span>
                      </button>
                    </div>
                  )}

                  {creationMode === "ai" && (
                    <div className="space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder={t.social.brandNamePlaceholder}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder={t.social.topicPlaceholder}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      </div>
                      <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        {TONES.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
                      </select>
                      {igCaption ? (
                        <div className="space-y-3 p-4 rounded-xl" style={{ background: "var(--surface-2)" }}>
                          <textarea value={igCaption} onChange={(e) => setIgCaption(e.target.value)} rows={4}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          <div className="flex flex-wrap gap-1.5">
                            {igHashtags.map((h, i) => <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{h}</span>)}
                          </div>
                          {igBestTime && <p className="text-xs" style={{ color: "var(--text-muted)" }}>⏰ {t.social.bestTime}: {igBestTime}</p>}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <button onClick={() => { setCreationMode(null); setIgCaption(""); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                          {isFa ? "بازگشت" : "Back"}
                        </button>
                        <button onClick={generateIgPost} disabled={igGenerating || !form.brandName || !form.topic}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                          {igGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          {igCaption ? (isFa ? "تولید دوباره" : "Regenerate") : t.social.igGenerateButton}
                        </button>
                        {igCaption && (
                          <button onClick={goToImageStep} className="mr-auto flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#e1306c" }}>
                            {isFa ? "بعدی" : "Next"} <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {creationMode === "recreate" && (
                    <div className="space-y-3">
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {isFa
                          ? "یک عکس از پستی که قبلاً خودتان طراحی کرده‌اید آپلود کنید — سیستم سبک بصری‌اش را تحلیل می‌کند، تصویر جدید مشابه می‌سازد، و کپشن و هشتگ متناسب می‌نویسد."
                          : "Upload a photo of a post you designed before — the system analyzes its visual style, generates a similar new image, and writes a matching caption and hashtags."}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-40 flex-shrink-0">
                          {refImageUrl ? (
                            <div className="relative">
                              <img src={refImageUrl} alt="reference" className="w-full h-40 object-cover rounded-xl" />
                              <button onClick={() => { setRefImageUrl(""); setStyleDescription(""); }} className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/60 text-white">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => refFileInputRef.current?.click()} disabled={refUploading}
                              className="w-full h-40 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-xs font-medium transition-all disabled:opacity-50"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                              {refUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                              {refUploading ? t.imageGeneratePage.uploading : t.imageGeneratePage.choosePhoto}
                            </button>
                          )}
                          <input ref={refFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleRefUpload} className="hidden" />
                        </div>
                        <div className="flex-1 flex flex-col gap-3">
                          <button onClick={recreateFromReference} disabled={!refImageUrl || recreating || !puterReady}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                            {recreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {recreating ? (recreateStep || (isFa ? "در حال پردازش..." : "Processing...")) : (isFa ? "تحلیل و بازسازی" : "Analyze & Recreate")}
                          </button>
                          {styleDescription && (
                            <p className="text-xs leading-6 p-3 rounded-xl" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{styleDescription}</p>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setCreationMode(null); setRefImageUrl(""); setStyleDescription(""); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                        {isFa ? "بازگشت" : "Back"}
                      </button>
                    </div>
                  )}

                  {creationMode === "manual" && (
                    <div className="space-y-3">
                      <textarea value={igCaption} onChange={(e) => setIgCaption(e.target.value)} rows={4}
                        placeholder={isFa ? "کپشن پست..." : "Post caption..."}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      <input value={manualHashtagsInput} onChange={(e) => setManualHashtagsInput(e.target.value)}
                        placeholder={isFa ? "هشتگ‌ها (با فاصله یا کاما جدا کن)" : "Hashtags (space or comma separated)"}
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      <div className="flex gap-2">
                        <button onClick={() => { setCreationMode(null); setIgCaption(""); setManualHashtagsInput(""); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                          {isFa ? "بازگشت" : "Back"}
                        </button>
                        <button onClick={confirmManualContent} disabled={!igCaption.trim()}
                          className="mr-auto flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "#e1306c" }}>
                          {isFa ? "بعدی" : "Next"} <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {creationMode === "calendar" && (
                    <div className="space-y-4">
                      {!calendarDays && (
                        <>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder={t.social.brandNamePlaceholder}
                              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder={t.social.topicPlaceholder}
                              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setCreationMode(null)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                              {isFa ? "بازگشت" : "Back"}
                            </button>
                            <button onClick={generateCalendar} disabled={calendarGenerating || !form.brandName || !form.topic}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                              {calendarGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                              {calendarGenerating ? (isFa ? "در حال ساخت تقویم..." : "Building calendar...") : (isFa ? "تولید تقویم ۷ روزه" : "Generate 7-day calendar")}
                            </button>
                          </div>
                        </>
                      )}

                      {calendarDays && (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {isFa ? "هر روز رو می‌تونی ویرایش کنی، بعد جدا یا همه با هم اضافه‌شون کن به زمان‌بندی (ساعت ۱۹:۰۰ هر روز، قابل تغییر از لیست پایین)." : "Edit each day, then add them individually or all at once (default 7:00 PM each day — adjust later from the list below)."}
                            </p>
                            <button onClick={scheduleAllCalendarDays}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#e1306c" }}>
                              <Check className="w-3.5 h-3.5" /> {isFa ? "افزودن همه" : "Add all"}
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {calendarDays.map((day) => (
                              <div key={day.dayOffset} className="rounded-xl overflow-hidden flex flex-col" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                                <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                    {isFa ? toJalali(day.date) : day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  </span>
                                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                    {day.date.toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <textarea
                                  value={day.caption}
                                  onChange={(e) => updateCalendarDay(day.dayOffset, { caption: e.target.value })}
                                  rows={5}
                                  className="w-full px-3 py-2 text-xs outline-none resize-none flex-1"
                                  style={{ background: "transparent", color: "var(--text-primary)" }}
                                />
                                <div className="flex flex-wrap gap-1 px-3 pb-2">
                                  {day.hashtags.slice(0, 3).map((h, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{h}</span>
                                  ))}
                                  {day.hashtags.length > 3 && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{day.hashtags.length - 3}</span>}
                                </div>
                                <button
                                  onClick={() => scheduleCalendarDay(day.dayOffset)}
                                  disabled={day.scheduling || day.scheduled}
                                  className="w-full px-3 py-2 text-xs font-medium disabled:opacity-70"
                                  style={{ background: day.scheduled ? "rgba(34,197,94,0.15)" : "var(--surface-1)", color: day.scheduled ? "#22c55e" : "var(--primary)", borderTop: "1px solid var(--border)" }}
                                >
                                  {day.scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : day.scheduled ? (isFa ? "✓ اضافه شد" : "✓ Added") : (isFa ? "افزودن به زمان‌بندی" : "Add to schedule")}
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setCreationMode(null); setCalendarDays(null); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                              {isFa ? "بازگشت" : "Back"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: image */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  {igImageUrl ? (
                    <div className="relative flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <img src={igImageUrl} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
                      <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "عکس انتخاب شد" : "Image selected"}</span>
                      <button onClick={openGalleryPicker} className="text-xs px-2 py-1 rounded-md flex-shrink-0" style={{ background: "var(--surface-1)", color: "var(--primary)" }}>
                        {isFa ? "تغییر" : "Change"}
                      </button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      <button onClick={generateImageFromTopic} disabled={aiImageGenerating || !form.brandName || !form.topic || !puterReady}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                        style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
                        {aiImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {aiImageGenerating ? (isFa ? "در حال ساخت عکس..." : "Generating image...") : (isFa ? "طراحی عکس با AI" : "Design image with AI")}
                      </button>
                      <button onClick={openGalleryPicker}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
                        <ImageIcon className="w-4 h-4" />
                        {isFa ? "انتخاب از گالری" : "Choose from gallery"}
                      </button>
                    </div>
                  )}
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {isFa ? "بدون انتخاب عکس هم می‌توانی ادامه بدی — پست فقط با متن و کپشن ثبت می‌شود." : "You can also continue without an image — the post will be text-only."}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                      {isFa ? "بازگشت" : "Back"}
                    </button>
                    <button onClick={() => setWizardStep(3)} className="mr-auto flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#e1306c" }}>
                      {isFa ? "بعدی" : "Next"} <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: schedule */}
              {wizardStep === 3 && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setScheduleChoice("now")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{ background: scheduleChoice === "now" ? "var(--primary)" : "var(--surface-2)", color: scheduleChoice === "now" ? "white" : "var(--text-secondary)" }}>
                      <Zap className="w-4 h-4" /> {isFa ? "همین الان" : "Right now"}
                    </button>
                    <button onClick={() => setScheduleChoice("scheduled")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{ background: scheduleChoice === "scheduled" ? "var(--primary)" : "var(--surface-2)", color: scheduleChoice === "scheduled" ? "white" : "var(--text-secondary)" }}>
                      <Clock className="w-4 h-4" /> {isFa ? "زمان مشخص" : "Specific time"}
                    </button>
                  </div>

                  {scheduleChoice === "scheduled" && (
                    <>
                      {isFa ? (
                        <JalaliDateTimePicker value={igScheduledFor} onChange={setIgScheduledFor}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      ) : (
                        <input value={igScheduledFor} onChange={(e) => setIgScheduledFor(e.target.value)} type="datetime-local"
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      )}
                      <div className="flex gap-1.5">
                        <button onClick={() => setIgMode("manual")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: igMode === "manual" ? "var(--primary)" : "var(--surface-2)", color: igMode === "manual" ? "white" : "var(--text-secondary)" }}>
                          {t.social.igManualMode}
                        </button>
                        <button onClick={() => canAuto && setIgMode("auto")} disabled={!canAuto}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                          style={{ background: igMode === "auto" ? "var(--primary)" : "var(--surface-2)", color: igMode === "auto" ? "white" : "var(--text-secondary)" }}>
                          {t.social.igAutoMode}
                        </button>
                      </div>
                      {!canAuto && (
                        <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "rgba(234,88,12,0.1)", color: "var(--primary)" }}>{t.social.igNoAutoNote}</p>
                      )}
                      {igMode === "auto" && (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {isFa
                            ? "با «حالت خودکار»، این پست دقیقاً در همان تاریخ/ساعتی که انتخاب کردی، بدون هیچ کلیک دیگری، خودکار در اینستاگرام منتشر می‌شود."
                            : "With Auto mode, this post gets published to Instagram automatically at the exact time you picked — no further clicks needed."}
                        </p>
                      )}
                    </>
                  )}
                  {scheduleChoice === "now" && (
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {isFa
                        ? canAuto
                          ? "پست همین الان وارد صف انتشار می‌شود و ظرف چند دقیقه در اینستاگرام منتشر می‌شود."
                          : "پست همین الان در لیست ثبت می‌شود — برای انتشار فوری، دکمه «انتشار الان» را از لیست پایین بزن."
                        : canAuto
                          ? "The post enters the publish queue right now and goes live on Instagram within a few minutes."
                          : "The post is added to the list right now — click \"Publish now\" from the list below to publish it immediately."}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep(2)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                      {isFa ? "بازگشت" : "Back"}
                    </button>
                    <button
                      onClick={() => setWizardStep(4)}
                      disabled={scheduleChoice === "scheduled" && !igScheduledFor}
                      className="mr-auto flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "#e1306c" }}>
                      {isFa ? "بعدی" : "Next"} <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: confirm */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "var(--surface-2)" }}>
                    {igImageUrl ? (
                      <img src={igImageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface-1)" }}>
                        <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{igCaption}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {igHashtags.map((h, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{h}</span>)}
                      </div>
                      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                        {scheduleChoice === "now"
                          ? (isFa ? "زمان‌بندی: همین الان" : "Timing: right now")
                          : `${isFa ? "زمان‌بندی" : "Timing"}: ${igScheduledFor ? (isFa ? toJalali(igScheduledFor) : new Date(igScheduledFor).toLocaleString("en-US")) : "—"} (${igMode === "auto" ? t.social.igAutoLabel : t.social.igManualLabel})`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep(3)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                      {isFa ? "بازگشت" : "Back"}
                    </button>
                    <button
                      onClick={() => {
                        if (scheduleChoice === "now") {
                          const now = new Date();
                          const pad = (n: number) => String(n).padStart(2, "0");
                          const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                          schedulePost({ scheduledFor: localNow, mode: canAuto ? "auto" : "manual" });
                        } else {
                          schedulePost();
                        }
                      }}
                      disabled={scheduling}
                      className="mr-auto flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "#e1306c" }}>
                      {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {scheduling ? t.social.igScheduling : (isFa ? "تایید و ثبت" : "Confirm & Save")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {posts.length > 0 && (
            <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>{t.social.igScheduledListTitle}</h3>
              <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}>{isFa ? "عکس" : "Image"}</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}>{isFa ? "کپشن" : "Caption"}</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}>{isFa ? "تاریخ/ساعت" : "Date/Time"}</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}>{isFa ? "حالت" : "Mode"}</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}>{isFa ? "وضعیت" : "Status"}</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--text-muted)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface-1)" : "transparent", borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2.5">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover" /> : <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: "var(--surface-2)" }}><ImageIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></div>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <span className="block truncate" style={{ color: "var(--text-secondary)" }}>{p.caption}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {isFa ? toJalali(p.scheduledFor) : new Date(p.scheduledFor).toLocaleDateString("en-US")}
                          {" "}{new Date(p.scheduledFor).toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {p.mode === "auto" ? t.social.igAutoLabel : t.social.igManualLabel}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full" style={{
                            background: p.status === "PUBLISHED" ? "rgba(34,197,94,0.1)" : p.status === "FAILED" ? "rgba(239,68,68,0.1)" : "rgba(234,88,12,0.1)",
                            color: p.status === "PUBLISHED" ? "var(--success)" : p.status === "FAILED" ? "var(--danger)" : "var(--primary)",
                          }}>
                            {p.status === "PUBLISHED" ? t.social.igPublishedStatus : p.status === "FAILED" ? t.social.igFailedStatus : t.social.igPendingStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {p.status === "PENDING" && igConnected && p.imageUrl && (
                            <button onClick={() => publishNow(p.id)} className="px-2 py-1 rounded-md" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>{t.social.igPublishNow}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Page analytics & growth */}
        <div className="rounded-2xl p-6 mt-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "#3b82f6" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {isFa ? "آنالیز و رشد پیج" : "Page Analytics & Growth"}
              </h2>
            </div>
            {igConnected && (
              <button onClick={loadAnalytics} disabled={analyticsLoading} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {analyticsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isFa ? "بروزرسانی" : "Refresh")}
              </button>
            )}
          </div>

          {!igConnected ? (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(234,88,12,0.1)", color: "var(--primary)" }}>
              {isFa ? "برای تحلیل پیج، اول اینستاگرام رو از بخش بالا وصل کن." : "Connect your Instagram account above to see page analytics."}
            </p>
          ) : analyticsLoading && !analytics ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "فالوور" : "Followers"}</span></div>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{analytics?.current?.followersCount ?? "—"}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-1.5 mb-1"><ImageIcon className="w-3.5 h-3.5" style={{ color: "#8b5cf6" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "تعداد پست" : "Posts"}</span></div>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{analytics?.current?.mediaCount ?? "—"}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "روند فالوور" : "Follower Trend"}</span></div>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {(analytics?.trend?.length ?? 0) >= 2
                      ? (() => { const d = analytics!.trend[analytics!.trend.length - 1].followersCount - analytics!.trend[0].followersCount; return `${d >= 0 ? "+" : ""}${d}`; })()
                      : (isFa ? "در حال جمع‌آوری" : "Collecting")}
                  </p>
                </div>
              </div>

              {/* Follower growth chart */}
              {(analytics?.trend?.length ?? 0) >= 2 ? (
                <div className="rounded-xl p-4 mb-5" style={{ background: "var(--surface-2)" }}>
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{isFa ? "روند رشد فالوور" : "Follower Growth Trend"}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics!.trend.map((d) => ({ ...d, dateLabel: isFa ? toJalali(d.date) : new Date(d.date).toLocaleDateString("en-US") }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="followersCount" stroke="#3b82f6" strokeWidth={2} dot={false} name={isFa ? "فالوور" : "Followers"} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs mb-5 px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  {isFa ? "نمودار روند رشد بعد از چند روز جمع‌آوری داده در دسترس قرار می‌گیرد (هر روز یک اسنپ‌شات گرفته می‌شود)." : "The growth trend chart becomes available after a few days of data collection (one snapshot per day)."}
                </p>
              )}

              {/* Content performance */}
              {(analytics?.recentMedia?.length ?? 0) > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{isFa ? "روند و عملکرد محتوا" : "Content Performance"}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {analytics!.recentMedia.map((m) => (
                      <a key={m.id} href={m.permalink} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden relative group" style={{ border: "1px solid var(--border)" }}>
                        <img src={m.thumbnailUrl || m.mediaUrl || ""} alt="" className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px]">
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {m.likeCount}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {m.commentsCount}</span>
                          <ExternalLink className="w-3 h-3 mt-1" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* AI growth report */}
              <button onClick={generateAiReport} disabled={aiReportLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
                {aiReportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiReportLoading ? (isFa ? "در حال تحلیل..." : "Analyzing...") : (isFa ? "تحلیل و برنامه رشد با AI" : "AI Growth Analysis & Plan")}
              </button>

              {aiReport && (
                <div className="mt-4 rounded-xl p-5 prose prose-sm max-w-none" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                  <ReactMarkdown>{aiReport}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Gallery picker modal */}
      {showGalleryPicker && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowGalleryPicker(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {lang === "fa" ? "انتخاب عکس از گالری" : "Choose an Image"}
              </h2>
              <button onClick={() => setShowGalleryPicker(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
              ) : galleryImages.length === 0 ? (
                <div className="text-center py-16">
                  <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {lang === "fa" ? "هنوز عکسی نساختی. اول از «تولید تصویر» یا «بازآفرینی از پست قبلی» یک عکس بساز." : "You haven't created any images yet. First generate one from Image Generation or Recreate from Sample Post."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => { setIgImageUrl(img.url); setShowGalleryPicker(false); }}
                      className="aspect-square rounded-xl overflow-hidden transition-all hover:opacity-80"
                      style={{ border: img.url === igImageUrl ? "2px solid var(--primary)" : "1px solid var(--border)" }}
                    >
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
