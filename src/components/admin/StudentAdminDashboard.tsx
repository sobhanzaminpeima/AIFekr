"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, Files, Layers3, Brain, CalendarDays, Users, Sparkles, ToggleLeft, ToggleRight, Loader2, ListTodo } from "lucide-react";

type Data = { enabled: boolean; stats: { activeUsers: number; courses: number; materials: number; notes: number; flashcards: number; quizzes: number; attempts: number; exams: number; tasks: number; aiRuns: number; averageScore: number | null }; recentCourses: { id: string; name: string; updatedAt: string; user: { id: string; name: string | null; email: string | null }; _count: { materials: number; quizzes: number; notes: number } }[] };

export default function StudentAdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch("/api/admin/student", { credentials: "include" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "دریافت اطلاعات ناموفق بود"); setData(body); }
    catch (error) { toast.error(error instanceof Error ? error.message : "خطا"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (!data || saving) return;
    setSaving(true);
    try { const response = await fetch("/api/admin/student", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !data.enabled }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "ذخیره ناموفق بود"); setData({ ...data, enabled: body.enabled }); toast.success(body.enabled ? "ماژول دانشجویی فعال شد" : "ماژول دانشجویی غیرفعال شد"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "خطا"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!data) return <div className="p-8">اطلاعات ماژول دانشجویی دریافت نشد.</div>;
  const cards = [
    [Users, "دانشجوی فعال", data.stats.activeUsers], [BookOpen, "درس‌ها", data.stats.courses], [Files, "جزوه‌ها", data.stats.materials],
    [Layers3, "یادداشت‌ها / فلش‌کارت‌ها", data.stats.notes + data.stats.flashcards], [Brain, "آزمون / تلاش", `${data.stats.quizzes} / ${data.stats.attempts}`],
    [CalendarDays, "امتحان‌های ثبت‌شده", data.stats.exams], [ListTodo, "تکلیف و جلسه مطالعه", data.stats.tasks], [Sparkles, "مصرف AI", data.stats.aiRuns], [Brain, "میانگین نتیجه", data.stats.averageScore == null ? "—" : `${data.stats.averageScore}%`],
  ] as const;
  return <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>دانشگاه هوش مصنوعی — کنترل مدیریتی</h1><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>سلامت استفاده، خروجی آموزشی و وضعیت دسترسی ماژول دانشجویی</p></div><button onClick={() => void toggle()} disabled={saving} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: data.enabled ? "#16a34a" : "#71717a" }}>{saving ? <Loader2 className="animate-spin w-4 h-4" /> : data.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{data.enabled ? "ماژول فعال است" : "ماژول غیرفعال است"}</button></header>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{cards.map(([Icon, label, value]) => <div key={label} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><Icon size={19} style={{ color: "var(--primary)" }} /><div className="mt-3 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{label}</div></div>)}</div>
    <section className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><h2 className="font-semibold p-4 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>درس‌های تازه‌فعالیت</h2>{data.recentCourses.length ? data.recentCourses.map((course) => <div key={course.id} className="flex flex-wrap justify-between gap-3 p-4 border-b last:border-0" style={{ borderColor: "var(--border)" }}><div><div className="font-medium" style={{ color: "var(--text-primary)" }}>{course.name}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{course.user.name || course.user.email || course.user.id}</div></div><div className="text-xs self-center" style={{ color: "var(--text-secondary)" }}>{course._count.materials} جزوه · {course._count.notes} یادداشت · {course._count.quizzes} آزمون</div></div>) : <p className="p-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>هنوز فعالیتی ثبت نشده است.</p>}</section>
  </div>;
}
