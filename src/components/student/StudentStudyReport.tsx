"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2, Pause, Play, Printer, Square } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type PauseEntry = { pausedAt: string; resumedAt: string | null };
type Session = { id: string; startedAt: string; endedAt: string | null; durationSeconds: number; pauseHistory: string; course: { id: string; name: string; color: string } | null };
type Report = {
  days: number; totalSeconds: number; sessionCount: number; page: number; pageSize: number; hasMore: boolean;
  active: { id: string; startedAt: string; lastResumedAt: string | null; pausedAt: string | null; durationSeconds: number; elapsedSeconds: number; pauseHistory: string; course: { id: string; name: string; color: string } | null } | null;
  byDay: { day: string; seconds: number }[];
  byCourse: { courseId: string | null; courseName: string; seconds: number; sessions: number }[];
  sessions: Session[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function durationText(seconds: number, lang: Lang) {
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return hours ? `${hours} ${tri(lang, "ساعت", "h", "Std.", "sa")} ${rest} ${tri(lang, "دقیقه", "min", "Min.", "dk")}` : `${mins} ${tri(lang, "دقیقه", "min", "Min.", "dk")}`;
}

export default function StudentStudyReport({ courses, lang, calendar }: { courses: { id: string; name: string }[]; lang: Lang; calendar: "persian" | "gregory" }) {
  const [report, setReport] = useState<Report | null>(null);
  const [courseId, setCourseId] = useState("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const baseLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const dateLocale = `${baseLocale}-u-ca-${calendar === "persian" ? "persian" : "gregory"}`;
  const dateLabel = useMemo(() => (value: string) => new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(value)), [dateLocale]);
  const monthLabel = useMemo(() => (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(dateLocale, { month: "short" }).format(new Date(Date.UTC(year, month - 1, 15)));
  }, [dateLocale]);

  const load = useCallback(async () => {
    setError("");
    try { setReport(await request<Report>(`/api/student/study-sessions?days=${days}&page=0`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load study report"); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  useEffect(() => { if (!report?.active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [report?.active?.id]);
  useEffect(() => { const refresh = () => void load(); window.addEventListener("student-timer-updated", refresh); return () => window.removeEventListener("student-timer-updated", refresh); }, [load]);

  const elapsed = report?.active ? report.active.durationSeconds + (report.active.pausedAt ? 0 : Math.max(0, Math.floor((now - new Date(report.active.lastResumedAt || report.active.startedAt).getTime()) / 1000))) : 0;
  const clock = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const monthly = useMemo(() => {
    const values = new Map<string, number>();
    for (const item of report?.byDay || []) {
      const key = item.day.slice(0, 7);
      values.set(key, (values.get(key) || 0) + item.seconds);
    }
    return Array.from(values.entries()).slice(-12).map(([month, seconds]) => ({ month, seconds }));
  }, [report?.byDay]);

  async function timerAction(action: "start" | "pause" | "resume" | "stop") {
    setBusy(true); setError("");
    try {
      if (action === "start") await request("/api/student/study-sessions", { method: "POST", body: JSON.stringify({ courseId: courseId || null }) });
      else await request("/api/student/study-sessions", { method: "PATCH", body: JSON.stringify({ action }) });
      window.dispatchEvent(new Event("student-timer-updated"));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Timer request failed"); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!report?.hasMore) return;
    setLoadingMore(true); setError("");
    try {
      const next = await request<Report>(`/api/student/study-sessions?days=${days}&page=${report.page + 1}`);
      setReport((current) => current ? { ...next, sessions: [...current.sessions, ...next.sessions] } : next);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load older sessions"); }
    finally { setLoadingMore(false); }
  }

  async function exportCsv() {
    if (!report?.sessionCount || exporting) return;
    setExporting(true); setError("");
    try {
      const allSessions: Session[] = [];
      for (let page = 0; page * report.pageSize < report.sessionCount; page += 1) {
        const data = await request<Report>(`/api/student/study-sessions?days=${days}&page=${page}`);
        allSessions.push(...data.sessions);
      }
      const rows = [["Date", "Course", "Started", "Ended", "Duration (minutes)", "Pause count", "Pause intervals (JSON)"], ...allSessions.map((s) => { let pauses: PauseEntry[] = []; try { pauses = JSON.parse(s.pauseHistory || "[]"); } catch { pauses = []; } return [new Date(s.startedAt).toISOString().slice(0, 10), s.course?.name || "Unassigned", new Date(s.startedAt).toISOString(), s.endedAt ? new Date(s.endedAt).toISOString() : "", String(Math.round(s.durationSeconds / 60)), String(pauses.length), JSON.stringify(pauses)]; })];
      const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `aifekr-study-report-${days}d.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not export study report"); }
    finally { setExporting(false); }
  }

  const panel: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };
  const card: React.CSSProperties = { background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 14 };
  return <section className="rounded-2xl p-4 md:p-6" style={panel}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 size={19} color="#f97316" />{tri(lang, "زمان‌سنج و گزارش مطالعه", "Study timer & progress report", "Lerntimer & Fortschrittsbericht", "Çalışma sayacı ve ilerleme raporu")}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "گزارش خلاصه است؛ جزئیات جلسه‌ها صفحه‌بندی می‌شوند و خروجی CSV همهٔ بازه را دارد.", "Summary stays compact; sessions are paginated and CSV includes the full range.", "Die Übersicht bleibt kompakt; Sitzungen sind paginiert, CSV enthält den gesamten Zeitraum.", "Özet kısa tutulur; oturumlar sayfalıdır, CSV tüm dönemi içerir.")}</p></div>
      <div className="flex flex-wrap gap-2"><select aria-label={tri(lang, "بازه گزارش", "Report range", "Berichtszeitraum", "Rapor aralığı")} value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }}><option value={7}>{tri(lang, "۷ روز", "7 days", "7 Tage", "7 gün")}</option><option value={30}>{tri(lang, "۳۰ روز", "30 days", "30 Tage", "30 gün")}</option><option value={90}>{tri(lang, "۹۰ روز", "90 days", "90 Tage", "90 gün")}</option><option value={365}>{tri(lang, "یک سال", "1 year", "1 Jahr", "1 yıl")}</option></select><button type="button" onClick={() => void exportCsv()} disabled={!report?.sessionCount || exporting} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--border)" }}><Download size={15}/>{exporting ? tri(lang, "در حال آماده‌سازی…", "Preparing…", "Wird vorbereitet…", "Hazırlanıyor…") : tri(lang, "خروجی کامل CSV", "Full CSV export", "Vollständiger CSV-Export", "Tam CSV indir")}</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><Printer size={15}/>{tri(lang, "چاپ برای استاد", "Print for instructor", "Für Lehrkraft drucken", "Öğretmen için yazdır")}</button></div>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.7fr)]">
      <div className="rounded-xl p-4" style={card}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "جلسهٔ فعلی", "Current session", "Aktuelle Sitzung", "Mevcut oturum")}</div><div role="timer" className="mt-1 font-mono text-3xl font-bold tabular-nums">{clock(elapsed)}</div>{report?.active?.course && <div className="mt-1 text-xs" style={{ color: report.active.course.color }}>{report.active.course.name}</div>}{report?.active?.pausedAt && <div className="mt-1 text-xs text-orange-500">{tri(lang, "زمان‌سنج مکث کرده؛ مکث در گزارش ثبت می‌شود.", "Timer paused; this break is recorded.", "Timer pausiert; die Pause wird erfasst.", "Sayaç duraklatıldı; ara kaydediliyor.")}</div>}</div>{report?.active ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void timerAction(report.active?.pausedAt ? "resume" : "pause")} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: report.active.pausedAt ? "#16a34a" : "#ea580c" }}>{busy ? <Loader2 size={16} className="animate-spin"/> : report.active.pausedAt ? <Play size={15}/> : <Pause size={15}/>}{report.active.pausedAt ? tri(lang, "ادامه", "Resume", "Fortsetzen", "Devam") : tri(lang, "مکث", "Pause", "Pause", "Duraklat")}</button><button type="button" disabled={busy} onClick={() => void timerAction("stop")} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: "#dc2626" }}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Square size={15} />}{tri(lang, "پایان مطالعه", "Stop session", "Sitzung beenden", "Oturumu bitir")}</button></div> : <div className="flex flex-wrap gap-2"><select aria-label={tri(lang, "انتخاب درس برای زمان‌سنج", "Course for timer", "Kurs für Timer", "Sayaç için ders")} value={courseId} onChange={(e) => setCourseId(e.target.value)} className="max-w-48 rounded-lg border px-2 py-2 text-sm" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}><option value="">{tri(lang, "بدون درس", "No course", "Kein Kurs", "Ders seçme")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><button type="button" disabled={busy} onClick={() => void timerAction("start")} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: "#16a34a" }}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Play size={15} />}{tri(lang, "شروع مطالعه", "Start studying", "Lernen starten", "Çalışmaya başla")}</button></div>}</div>
      </div>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl p-4" style={card}><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کل زمان بازه", "Tracked in range", "Erfasste Zeit", "Toplam süre")}</div><div className="mt-2 text-lg font-bold">{loading ? "—" : durationText(report?.totalSeconds || 0, lang)}</div></div><div className="rounded-xl p-4" style={card}><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کل جلسه‌ها", "Total sessions", "Sitzungen gesamt", "Toplam oturum")}</div><div className="mt-2 text-lg font-bold">{report?.sessionCount ?? "—"}</div></div></div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    {loading ? <div className="py-6 text-center"><Loader2 className="inline animate-spin"/></div> : !report?.sessionCount ? <p className="mt-4 rounded-xl p-5 text-center text-sm" style={{ ...card, color: "var(--text-secondary)" }}>{tri(lang, "هنوز جلسه‌ای ثبت نشده؛ برای شروع، زمان‌سنج را روشن کن.", "No sessions yet. Start the timer to begin tracking.", "Noch keine Sitzungen. Starte den Timer.", "Henüz oturum yok. Takip için sayacı başlat.")}</p> : <>
      {days > 90 ? <div className="mt-4 rounded-xl p-4" style={card}><div className="mb-3 text-sm font-semibold">{tri(lang, "روند ماهانه · حداکثر ۱۲ ماه", "Monthly trend · up to 12 months", "Monatlicher Verlauf · bis zu 12 Monate", "Aylık eğilim · en fazla 12 ay")}</div><div className="grid grid-cols-6 gap-2 sm:grid-cols-12">{monthly.map(({ month, seconds }) => { const max = Math.max(1, ...monthly.map((m) => m.seconds)); return <div key={month} className="min-w-0 text-center" title={`${monthLabel(month)} · ${durationText(seconds, lang)}`}><div className="flex h-24 items-end justify-center"><div className="w-full max-w-7 rounded-t-md" style={{ height: `${Math.max(5, seconds / max * 100)}%`, background: "#f97316" }} /></div><div className="mt-1 truncate text-[10px]" style={{ color: "var(--text-secondary)" }}>{monthLabel(month)}</div></div>; })}</div></div> : <div className="mt-4 rounded-xl p-4" style={card}><h3 className="mb-3 text-sm font-semibold">{tri(lang, "روزهای اخیر", "Recent days", "Letzte Tage", "Son günler")}</h3><div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">{report.byDay.slice(-14).reverse().map((item) => <div key={item.day} className="flex justify-between gap-2 text-sm"><span>{dateLabel(item.day)}</span><span className="font-medium">{durationText(item.seconds, lang)}</span></div>)}</div></div>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl p-4" style={card}><h3 className="mb-3 text-sm font-semibold">{tri(lang, "زمان به تفکیک درس · کل بازه", "Time by course · full range", "Zeit nach Kurs · gesamter Zeitraum", "Derse göre süre · tüm dönem")}</h3><div className="space-y-2">{report.byCourse.map((item) => <div key={item.courseId || "none"} className="flex justify-between gap-2 text-sm"><span className="truncate">{item.courseName} <small style={{ color: "var(--text-secondary)" }}>· {item.sessions}</small></span><span className="shrink-0 font-medium">{durationText(item.seconds, lang)}</span></div>)}</div></div><div className="rounded-xl p-4" style={card}><h3 className="mb-1 text-sm font-semibold">{tri(lang, "جلسه‌های اخیر", "Recent sessions", "Letzte Sitzungen", "Son oturumlar")}</h3><p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, `نمایش ${report.sessions.length} از ${report.sessionCount} جلسه`, `Showing ${report.sessions.length} of ${report.sessionCount} sessions`, `${report.sessions.length} von ${report.sessionCount} Sitzungen`, `${report.sessionCount} oturumdan ${report.sessions.length} gösteriliyor`)}</p><div className="max-h-72 space-y-2 overflow-y-auto">{report.sessions.map((session) => { let pauses: PauseEntry[] = []; try { pauses = JSON.parse(session.pauseHistory || "[]"); } catch { pauses = []; } return <div key={session.id} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)" }}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{session.course?.name || tri(lang, "بدون درس", "Unassigned", "Ohne Kurs", "Derssiz")}</div><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{dateLabel(session.startedAt)} · {new Intl.DateTimeFormat(baseLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))}</div></div><span className="shrink-0 text-xs">{durationText(session.durationSeconds, lang)}</span></div>{pauses.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer" style={{ color: "var(--text-secondary)" }}>{tri(lang, `${pauses.length} مکث ثبت‌شده`, `${pauses.length} recorded break(s)`, `${pauses.length} erfasste Pause(n)`, `${pauses.length} kayıtlı ara`)}</summary><ul className="mt-1 space-y-1 ps-4">{pauses.map((pause, index) => <li key={`${pause.pausedAt}-${index}`}>{dateLabel(pause.pausedAt)} · {new Intl.DateTimeFormat(baseLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(pause.pausedAt))} – {pause.resumedAt ? new Intl.DateTimeFormat(baseLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(pause.resumedAt)) : tri(lang, "هنوز در مکث", "still paused", "noch pausiert", "hala duraklatıldı")}</li>)}</ul></details>}</div>; })}</div>{report.hasMore && <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{loadingMore ? <Loader2 size={15} className="mx-auto animate-spin"/> : tri(lang, "نمایش جلسه‌های قدیمی‌تر", "Load older sessions", "Ältere Sitzungen laden", "Daha eski oturumları yükle")}</button>}</div></div>
    </>}
  </section>;
}
