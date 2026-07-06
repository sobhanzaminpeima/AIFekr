"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, Copy, Check, Calendar, Camera, Zap, Loader2, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter/X", "Facebook", "TikTok"];
const TONES = [
  { value: "Professional", label: "حرفه‌ای" },
  { value: "Casual", label: "غیررسمی" },
  { value: "Funny", label: "طنز" },
  { value: "Inspirational", label: "الهام‌بخش" },
  { value: "Educational", label: "آموزشی" },
];

export default function SocialPage() {
  const [form, setForm] = useState({
    brandName: "",
    topic: "",
    platform: "Instagram",
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
    if (status === "connected") toast.success("اینستاگرام با موفقیت متصل شد");
    if (status === "failed") toast.error("اتصال اینستاگرام ناموفق بود");
    if (status === "no-ig-account") toast.error("هیچ حساب Business اینستاگرام روی صفحه‌ی فیسبوک شما پیدا نشد");
  }, [loadIgStatus]);

  async function generateIgPost() {
    if (!form.brandName || !form.topic) return toast.error("نام کسب‌وکار و موضوع را وارد کنید");
    setIgGenerating(true);
    try {
      const r = await fetch("/api/social/instagram/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: form.brandName, businessType: form.platform, topic: form.topic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setIgCaption(d.caption || "");
      setIgHashtags(d.hashtags || []);
      setIgBestTime(d.bestTime || "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setIgGenerating(false); }
  }

  async function schedulePost() {
    if (!igCaption || !igScheduledFor) return toast.error("کپشن و زمان انتشار الزامی است");
    setScheduling(true);
    try {
      const r = await fetch("/api/social/instagram/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: igCaption, hashtags: igHashtags, imageUrl: igImageUrl || null, scheduledFor: igScheduledFor, mode: igMode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(igMode === "auto" ? "پست زمان‌بندی شد و به‌صورت خودکار منتشر می‌شود" : "پست ذخیره شد — در زمان مقرر خودتان منتشر کنید");
      setIgCaption(""); setIgHashtags([]); setIgImageUrl(""); setIgScheduledFor("");
      loadIgStatus();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
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
      toast.success("منتشر شد");
      loadIgStatus();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا در انتشار"); }
  }

  async function generate(type: "posts" | "calendar") {
    const setter = type === "calendar" ? setCalendarLoading : setLoading;
    setter(true);
    setResult("");

    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Share2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>عامل شبکه‌های اجتماعی</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>تولید محتوای بهینه برای هر پلتفرم</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>نام برند / کسب‌وکار</label>
              <input
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder="مثال: کافه پارس"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>موضوع پست یا محصول</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="مثال: لانچ محصول جدید، تخفیف ۲۰٪..."
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>پلتفرم</label>
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
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>لحن</label>
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>هشتگ داشته باشد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emojis}
                  onChange={(e) => setForm({ ...form, emojis: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>ایموجی داشته باشد</span>
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
              تولید پست
            </button>
            <button
              onClick={() => generate("calendar")}
              disabled={!form.brandName || !form.topic || calendarLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {calendarLoading ? <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
              تقویم محتوایی ۷ روزه
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>محتوای تولید شده</h2>
              <button
                onClick={copyResult}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "کپی شد" : "کپی همه"}
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Instagram automation */}
        <div className="rounded-2xl p-6 mt-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" style={{ color: "#e1306c" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>خودکارسازی اینستاگرام</h2>
            </div>
            {igConnected ? (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)" }}>
                متصل: @{igUsername}
              </span>
            ) : (
              <a href="/api/social/instagram/connect" className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: "#e1306c" }}>
                اتصال حساب اینستاگرام
              </a>
            )}
          </div>

          {!canAuto && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "rgba(234,88,12,0.1)", color: "var(--primary)" }}>
              انتشار خودکار فقط برای پلن‌های حرفه‌ای و تیمی فعال است. با پلن فعلی می‌توانید محتوا تولید کنید ولی باید خودتان دستی پابلیش کنید.
            </p>
          )}

          <button onClick={generateIgPost} disabled={igGenerating || !form.brandName || !form.topic}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 mb-4" style={{ background: "var(--primary)" }}>
            {igGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            تولید پست + ۵ هشتگ ویروسی (از فرم بالا)
          </button>

          {igCaption && (
            <div className="space-y-3 p-4 rounded-xl mb-4" style={{ background: "var(--surface-2)" }}>
              <textarea value={igCaption} onChange={e => setIgCaption(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <div className="flex flex-wrap gap-1.5">
                {igHashtags.map((h, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{h}</span>
                ))}
              </div>
              {igBestTime && <p className="text-xs" style={{ color: "var(--text-muted)" }}>⏰ بهترین زمان انتشار: {igBestTime}</p>}

              <div className="grid sm:grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <ImageIcon className="w-4 h-4 mt-2.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input value={igImageUrl} onChange={e => setIgImageUrl(e.target.value)} dir="ltr" placeholder="آدرس تصویر پست (از گالری من)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <input value={igScheduledFor} onChange={e => setIgScheduledFor(e.target.value)} type="datetime-local"
                  className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <button onClick={() => setIgMode("manual")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: igMode === "manual" ? "var(--primary)" : "var(--surface-1)", color: igMode === "manual" ? "white" : "var(--text-secondary)" }}>
                    پابلیش دستی
                  </button>
                  <button onClick={() => canAuto && setIgMode("auto")} disabled={!canAuto}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ background: igMode === "auto" ? "var(--primary)" : "var(--surface-1)", color: igMode === "auto" ? "white" : "var(--text-secondary)" }}>
                    ثبت اتوماتیک
                  </button>
                </div>
                <button onClick={schedulePost} disabled={scheduling}
                  className="mr-auto px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "#e1306c" }}>
                  {scheduling ? "در حال ذخیره..." : "افزودن به تقویم انتشار"}
                </button>
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>پست‌های زمان‌بندی‌شده</h3>
              {posts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg text-xs" style={{ background: "var(--surface-2)" }}>
                  <div className="truncate flex-1" style={{ color: "var(--text-secondary)" }}>
                    {p.caption.slice(0, 60)}... — {new Date(p.scheduledFor).toLocaleString("fa-IR")}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full" style={{
                      background: p.status === "PUBLISHED" ? "rgba(34,197,94,0.1)" : p.status === "FAILED" ? "rgba(239,68,68,0.1)" : "rgba(234,88,12,0.1)",
                      color: p.status === "PUBLISHED" ? "var(--success)" : p.status === "FAILED" ? "var(--danger)" : "var(--primary)",
                    }}>
                      {p.mode === "auto" ? "خودکار" : "دستی"} · {p.status === "PUBLISHED" ? "منتشرشده" : p.status === "FAILED" ? "ناموفق" : "در انتظار"}
                    </span>
                    {p.status === "PENDING" && igConnected && p.imageUrl && (
                      <button onClick={() => publishNow(p.id)} className="px-2 py-1 rounded-md" style={{ background: "var(--surface-1)", color: "var(--primary)" }}>انتشار الان</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
