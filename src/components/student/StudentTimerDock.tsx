"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type ActiveTimer = {
  id: string;
  startedAt: string;
  lastResumedAt: string | null;
  pausedAt: string | null;
  durationSeconds: number;
  elapsedSeconds: number;
  course: { id: string; name: string; color: string } | null;
};

export default function StudentTimerDock({ lang }: { lang: Lang }) {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/student/study-sessions?activeOnly=1", { cache: "no-store" });
      if (!response.ok) { setActive(null); return; }
      const data = await response.json();
      setActive(data.active || null);
      setSyncedAt(Date.now());
    } catch { /* Keep the last known timer visible during a short network interruption. */ }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 15_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const onFocus = () => void refresh();
    const onTimerChanged = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("student-timer-updated", onTimerChanged);
    return () => { window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener("focus", onFocus); window.removeEventListener("student-timer-updated", onTimerChanged); };
  }, [refresh]);

  async function perform(action: "pause" | "resume" | "stop") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/student/study-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Timer update failed");
      window.dispatchEvent(new Event("student-timer-updated"));
      if (action === "stop") setActive(null);
      else await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Timer update failed");
      await refresh();
    } finally { setBusy(false); }
  }

  if (!active) return null;
  const elapsed = active.pausedAt ? active.elapsedSeconds : active.elapsedSeconds + Math.max(0, Math.floor((now - syncedAt) / 1000));
  const clock = `${Math.floor(elapsed / 3600).toString().padStart(2, "0")}:${Math.floor(elapsed % 3600 / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;
  const paused = !!active.pausedAt;

  return <aside aria-label={tri(lang, "زمان‌سنج مطالعهٔ فعال", "Active study timer", "Aktiver Lerntimer", "Etkin çalışma sayacı")} className="fixed bottom-20 right-3 z-[60] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-3 shadow-2xl sm:right-5" style={{ background: "var(--surface-1)", border: `1px solid ${paused ? "rgba(234,88,12,.4)" : "rgba(34,197,94,.38)"}` }}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: paused ? "#ea580c" : "#16a34a" }}><span className={`h-2 w-2 rounded-full ${paused ? "" : "animate-pulse"}`} style={{ background: paused ? "#ea580c" : "#16a34a" }}/>{paused ? tri(lang, "مطالعه متوقف موقت", "Study paused", "Lernen pausiert", "Çalışma duraklatıldı") : tri(lang, "در حال مطالعه", "Studying", "Lernen läuft", "Çalışılıyor")}</div>
        <div role="timer" aria-live="off" className="mt-1 font-mono text-xl font-bold tabular-nums">{clock}</div>
        {active.course && <div className="truncate text-xs" style={{ color: active.course.color }}>{active.course.name}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" disabled={busy} onClick={() => void perform(paused ? "resume" : "pause")} aria-label={paused ? tri(lang, "ادامهٔ مطالعه", "Resume studying", "Lernen fortsetzen", "Çalışmaya devam et") : tri(lang, "توقف موقت مطالعه", "Pause studying", "Lernen pausieren", "Çalışmayı duraklat")} title={paused ? tri(lang, "ادامه", "Resume", "Fortsetzen", "Devam") : tri(lang, "مکث", "Pause", "Pause", "Duraklat")} className="grid h-10 w-10 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: paused ? "#16a34a" : "#ea580c" }}>{busy ? <Loader2 size={17} className="animate-spin"/> : paused ? <Play size={17}/> : <Pause size={17}/>}</button>
        <button type="button" disabled={busy} onClick={() => void perform("stop")} aria-label={tri(lang, "پایان جلسهٔ مطالعه", "End study session", "Lernsitzung beenden", "Çalışma oturumunu bitir")} title={tri(lang, "پایان", "Finish", "Beenden", "Bitir")} className="grid h-10 w-10 place-items-center rounded-xl border disabled:opacity-50" style={{ color: "#dc2626", borderColor: "var(--border)" }}><Square size={15}/></button>
      </div>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
  </aside>;
}
