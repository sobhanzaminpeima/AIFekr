"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2, Play, Printer, Square } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Report = {
  days: number; totalSeconds: number; sessionCount: number;
  active: { id: string; startedAt: string; course: { id: string; name: string; color: string } | null } | null;
  byDay: { day: string; seconds: number }[];
  byCourse: { courseId: string | null; courseName: string; seconds: number; sessions: number }[];
  sessions: { id: string; startedAt: string; endedAt: string | null; durationSeconds: number; course: { id: string; name: string; color: string } | null }[];
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const baseLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const dateLabel = useMemo(() => (value: string) => new Intl.DateTimeFormat(calendar === "persian" ? `${baseLocale}-u-ca-persian` : `${baseLocale}-u-ca-gregory`, { dateStyle: "medium" }).format(new Date(value)), [baseLocale, calendar]);

  const load = useCallback(async () => {
    setError("");
    try { setReport(await request<Report>(`/api/student/study-sessions?days=${days}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load study report"); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!report?.active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [report?.active?.id]);

  const elapsed = report?.active ? Math.max(0, Math.floor((now - new Date(report.active.startedAt).getTime()) / 1000)) : 0;
  const clock = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  async function timerAction(action: "start" | "stop") {
    setBusy(true); setError("");
    try {
      if (action === "start") await request("/api/student/study-sessions", { method: "POST", body: JSON.stringify({ courseId: courseId || null }) });
      else await request("/api/student/study-sessions", { method: "PATCH", body: "{}" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Timer request failed"); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    if (!report) return;
    const rows = [["Date", "Course", "Started", "Ended", "Duration (minutes)"], ...report.sessions.map((s) => [new Date(s.startedAt).toISOString().slice(0, 10), s.course?.name || "Unassigned", new Date(s.startedAt).toISOString(), s.endedAt ? new Date(s.endedAt).toISOString() : "", String(Math.round(s.durationSeconds / 60))])];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `aifekr-study-report-${days}d.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const panel: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };
  return <section className="mt-6 rounded-2xl p-5 md:p-6" style={panel}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 size={19} color="#f97316" />{tri(lang, "زمان‌سنج و گزارش مطالعه", "Study timer & progress report", "Lerntimer & Fortschrittsbericht", "Çalışma sayacı ve ilerleme raporu")}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "زمان از سرور ثبت می‌شود و گزارش را می‌توانی برای استاد دانلود یا چاپ کنی.", "Sessions are timestamped by the server. Download or print this report for your instructor.", "Sitzungen werden serverseitig protokolliert. Bericht für Lehrkräfte herunterladen oder drucken.", "Oturumlar sunucu saatine göre kaydedilir; raporu öğretmenin için indir veya yazdır.")}</p></div>
      <div className="flex flex-wrap gap-2"><select aria-label={tri(lang, "بازه گزارش", "Report range", "Berichtszeitraum", "Rapor aralığı")} value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }}><option value={7}>{tri(lang, "۷ روز", "7 days", "7 Tage", "7 gün")}</option><option value={30}>{tri(lang, "۳۰ روز", "30 days", "30 Tage", "30 gün")}</option><option value={90}>{tri(lang, "۹۰ روز", "90 days", "90 Tage", "90 gün")}</option></select><button type="button" onClick={exportCsv} disabled={!report?.sessions.length} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--border)" }}><Download size={15}/>{tri(lang, "خروجی CSV", "Export CSV", "CSV exportieren", "CSV indir")}</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><Printer size={15}/>{tri(lang, "چاپ برای استاد", "Print for instructor", "Für Lehrkraft drucken", "Öğretmen için yazdır")}</button></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
      <div className="rounded-xl p-4" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "جلسهٔ فعلی", "Current session", "Aktuelle Sitzung", "Mevcut oturum")}</div><div role="timer" className="mt-1 font-mono text-3xl font-bold tabular-nums">{clock(elapsed)}</div>{report?.active?.course && <div className="mt-1 text-xs" style={{ color: report.active.course.color }}>{report.active.course.name}</div>}</div>{report?.active ? <button type="button" disabled={busy} onClick={() => void timerAction("stop")} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: "#dc2626" }}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Square size={15} />}{tri(lang, "پایان مطالعه", "Stop session", "Sitzung beenden", "Oturumu bitir")}</button> : <div className="flex flex-wrap gap-2"><select aria-label={tri(lang, "انتخاب درس برای زمان‌سنج", "Course for timer", "Kurs für Timer", "Sayaç için ders")} value={courseId} onChange={(e) => setCourseId(e.target.value)} className="max-w-48 rounded-lg border px-2 py-2 text-sm" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}><option value="">{tri(lang, "بدون درس", "No course", "Kein Kurs", "Ders seçme")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><button type="button" disabled={busy} onClick={() => void timerAction("start")} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: "#16a34a" }}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Play size={15} />}{tri(lang, "شروع مطالعه", "Start studying", "Lernen starten", "Çalışmaya başla")}</button></div>}</div>
      </div>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl p-4" style={{ background: "var(--surface-0)" }}><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "زمان ثبت‌شده", "Tracked time", "Erfasste Zeit", "Kaydedilen süre")}</div><div className="mt-2 text-lg font-bold">{loading ? "—" : durationText(report?.totalSeconds || 0, lang)}</div></div><div className="rounded-xl p-4" style={{ background: "var(--surface-0)" }}><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "جلسه‌ها", "Sessions", "Sitzungen", "Oturumlar")}</div><div className="mt-2 text-lg font-bold">{report?.sessionCount ?? "—"}</div></div></div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    {loading ? <div className="py-6 text-center"><Loader2 className="inline animate-spin"/></div> : !report?.sessions.length ? <p className="mt-4 rounded-xl p-5 text-center text-sm" style={{ background: "var(--surface-0)", color: "var(--text-secondary)" }}>{tri(lang, "هنوز جلسه‌ای ثبت نشده؛ برای شروع، زمان‌سنج را روشن کن.", "No sessions yet. Start the timer to begin tracking.", "Noch keine Sitzungen. Starte den Timer.", "Henüz oturum yok. Takip için sayacı başlat.")}</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl p-4" style={{ background: "var(--surface-0)" }}><h3 className="mb-3 text-sm font-semibold">{tri(lang, "زمان به تفکیک درس", "Time by course", "Zeit nach Kurs", "Derse göre süre")}</h3><div className="space-y-2">{report.byCourse.map((item) => <div key={item.courseId || "none"} className="flex justify-between gap-2 text-sm"><span className="truncate">{item.courseName} <small style={{ color: "var(--text-secondary)" }}>· {item.sessions}</small></span><span className="shrink-0 font-medium">{durationText(item.seconds, lang)}</span></div>)}</div></div><div className="rounded-xl p-4" style={{ background: "var(--surface-0)" }}><h3 className="mb-3 text-sm font-semibold">{tri(lang, "روزهای اخیر", "Recent days", "Letzte Tage", "Son günler")}</h3><div className="max-h-44 space-y-2 overflow-auto">{report.byDay.slice(-14).reverse().map((item) => <div key={item.day} className="flex justify-between gap-2 text-sm"><span>{dateLabel(item.day)}</span><span className="font-medium">{durationText(item.seconds, lang)}</span></div>)}</div></div></div>}
  </section>;
}
