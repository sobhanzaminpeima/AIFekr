"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Plus, RefreshCw, Trash2, Users2, ThumbsDown, Sparkles, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";
import CreditCost from "@/components/ui/CreditCost";

interface CompetitorPost {
  caption: string | null;
  likeCount: number;
  commentsCount: number;
  mediaProductType: string | null;
  mediaType: string | null;
  timestamp: string;
  permalink: string | null;
  thumbnailUrl: string | null;
}

interface Competitor {
  id: string;
  username: string;
  label: string | null;
  isActive: boolean;
  lastError: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  lastCheckedAt: string | null;
  topPosts: CompetitorPost[];
}

/**
 * Benchmarking against comparable public pages, via Meta's official
 * business_discovery edge (never scraping). Until instagram_basic clears App
 * Review the panel says so plainly instead of offering a button that errors.
 */
export default function CompetitorsPanel({ lang }: { lang: Lang }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [max, setMax] = useState(5);
  const [rows, setRows] = useState<Competitor[]>([]);
  const [handle, setHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(() => {
    fetch("/api/social/competitors", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setMax(d.max ?? 5); setRows(d.competitors || []); })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(load, [load]);

  async function add() {
    const u = handle.replace(/^@/, "").trim();
    if (!u) return;
    setAdding(true);
    try {
      const res = await fetch("/api/social/competitors", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ username: u }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.warning) toast(d.warning);
      else toast.success(tri(lang, "اضافه شد", "Added", "Hinzugefügt"));
      setHandle("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setAdding(false);
    }
  }

  async function refresh(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/competitors/${id}/refresh`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(tri(lang, "به‌روزرسانی شد", "Refreshed", "Aktualisiert"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm(tri(lang, "حذف شود؟", "Remove?", "Entfernen?"))) return;
    await fetch(`/api/social/competitors?id=${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  async function analyze() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/social/competitors/analyze", { method: "POST", credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAnalysis(d.analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function reject() {
    const reason = window.prompt(tri(lang, "چرا به برند شما نمی‌خورد؟", "Why doesn't this fit your brand?", "Warum passt das nicht zu Ihrer Marke?"));
    if (!reason?.trim()) return;
    const res = await fetch("/api/social/competitors/reject", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast.success(tri(lang, "ثبت شد — پیشنهاد بعدی این را در نظر می‌گیرد", "Noted — the next suggestion will account for it", "Notiert — der nächste Vorschlag berücksichtigt das"));
      setAnalysis(null);
    }
  }

  if (enabled === null) return null;

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Users2 className="w-4 h-4" style={{ color: "#ea580c" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "تحلیل پیج‌های مشابه", "Comparable pages", "Vergleichbare Seiten")}
        </h3>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        {tri(lang,
          "پیج‌های مشابه کسب‌وکار خودتان را اضافه کنید تا ببینید چه محتوایی برایشان جواب داده و چرا — داده مستقیماً از API رسمی متا می‌آید.",
          "Add pages comparable to your business to see what content works for them and why — data comes straight from Meta's official API.",
          "Fügen Sie vergleichbare Seiten hinzu, um zu sehen, welche Inhalte dort funktionieren und warum — Daten direkt aus Metas offizieller API.")}
      </p>

      {!enabled && (
        <p className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "rgba(234,179,8,0.12)", color: "#ca8a04" }}>
          {tri(lang,
            "این قابلیت در انتظار تأیید App Review متا است. می‌توانید رقبا را همین حالا اضافه کنید؛ به‌محض تأیید، داده‌ها خودکار جمع می‌شوند.",
            "Waiting on Meta App Review. You can add competitors now — data starts collecting automatically once it's approved.",
            "Wartet auf Metas App Review. Sie können Wettbewerber jetzt hinzufügen — die Daten werden nach der Freigabe automatisch erfasst.")}
        </p>
      )}

      <div className="flex gap-2 mb-3">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={tri(lang, "نام کاربری اینستاگرام (بدون @)", "Instagram username (no @)", "Instagram-Benutzername (ohne @)")}
          dir="ltr"
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button onClick={add} disabled={adding || rows.length >= max}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {tri(lang, "افزودن", "Add", "Hinzufügen")}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "هنوز پیجی اضافه نشده.", "No pages added yet.", "Noch keine Seiten hinzugefügt.")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-sm font-medium" dir="ltr" style={{ color: "var(--text-primary)" }}>@{c.username}</span>
                  {c.followersCount !== null && (
                    <span className="text-xs ms-2" style={{ color: "var(--text-muted)" }}>
                      {c.followersCount.toLocaleString()} {tri(lang, "فالوور", "followers", "Follower")} · {c.mediaCount} {tri(lang, "پست", "posts", "Beiträge")}
                    </span>
                  )}
                  {c.lastError && <p className="text-[11px] mt-0.5" style={{ color: "#dc2626" }}>{c.lastError}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => refresh(c.id)} disabled={busyId === c.id || !enabled} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                  </button>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    <Trash2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              </div>

              {c.topPosts.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                  {c.topPosts
                    .slice()
                    .sort((a, b) => b.likeCount + b.commentsCount - (a.likeCount + a.commentsCount))
                    .slice(0, 5)
                    .map((p, i) => (
                      <a key={i} href={p.permalink || "#"} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg overflow-hidden relative group" style={{ border: "1px solid var(--border)" }}>
                        {p.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/social/instagram/media-proxy?url=${encodeURIComponent(p.thumbnailUrl)}`} alt=""
                            className="w-full aspect-square object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : <div className="w-full aspect-square" style={{ background: "var(--surface-1)" }} />}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] gap-0.5">
                          <span>❤ {p.likeCount}</span>
                          <span>💬 {p.commentsCount}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                        {p.mediaProductType === "REELS" && (
                          <span className="absolute top-1 end-1 text-[9px] px-1 rounded bg-black/70 text-white">Reel</span>
                        )}
                      </a>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rows.some((r) => r.topPosts.length > 0) && (
        <button onClick={analyze} disabled={analyzing}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }}>
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {tri(lang, "تحلیل کن و برای برند من پیشنهاد بده", "Analyse & suggest for my brand", "Analysieren & für meine Marke vorschlagen")} <CreditCost feature="social.competitors" />
        </button>
      )}

      {analysis && (
        <div className="mt-3 rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(234,179,8,0.15)", color: "#ca8a04" }}>
              {tri(lang, "پیش‌نویس — نیاز به تأیید شما", "Draft — needs your approval", "Entwurf — Ihre Freigabe erforderlich")}
            </span>
            <button onClick={reject} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
              <ThumbsDown className="w-3.5 h-3.5" />
              {tri(lang, "به برند من نمی‌خورد", "Doesn't fit my brand", "Passt nicht zu meiner Marke")}
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
