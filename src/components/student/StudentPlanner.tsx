"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ChevronDown, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Course = { id: string; name: string };
type Exam = { id: string; title: string; examAt: string; course: { id: string; name: string; color: string } };
type Task = { id: string; title: string; description: string; taskType: string; dueAt: string | null; priority: number; completedAt: string | null; generated: boolean; course: { id: string; name: string; color: string } | null };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

export default function StudentPlanner({ courses, exams, lang, calendar }: { courses: Course[]; exams: Exam[]; lang: Lang; calendar: "persian" | "gregory" }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [taskType, setTaskType] = useState<"assignment" | "study">("assignment");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState<"open" | "completed" | "all">("open");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (selectedExamId && exams.some((exam) => exam.id === selectedExamId)) return;
    setSelectedExamId(exams[0]?.id || "");
  }, [exams, selectedExamId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTasks((await request<{ tasks: Task[] }>("/api/student/tasks")).tasks); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load tasks"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError("");
    try {
      await request("/api/student/tasks", { method: "POST", body: JSON.stringify({ title, courseId: courseId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, taskType }) });
      setTitle(""); setDueAt(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save task"); }
    finally { setSaving(false); }
  }

  async function toggle(task: Task) {
    setError("");
    try { await request(`/api/student/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ completed: !task.completedAt }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update task"); }
  }

  async function remove(task: Task) {
    setError("");
    try { await request(`/api/student/tasks/${task.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete task"); }
  }

  async function makePlan() {
    setSaving(true); setError("");
    try {
      const result = await request<{ created: number; message: string }>("/api/student/study-plan", { method: "POST", body: JSON.stringify({ examId: selectedExamId }) });
      if (!result.created) setError(result.message); else await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create study plan"); }
    finally { setSaving(false); }
  }

  const baseLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const dateText = (value: string) => new Intl.DateTimeFormat(calendar === "persian" ? `${baseLocale}-u-ca-persian` : `${baseLocale}-u-ca-gregory`, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const filteredTasks = tasks.filter((task) => (!courseFilter || task.course?.id === courseFilter) && (taskFilter === "all" || (taskFilter === "completed" ? !!task.completedAt : !task.completedAt)));
  const visibleTasks = showAll ? filteredTasks : filteredTasks.slice(0, 5);
  const panel: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };

  return <section className="rounded-2xl p-5 md:p-6 mb-7" style={panel}>
    <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
      <div><h2 className="font-semibold text-lg flex gap-2 items-center"><CalendarClock size={19} color="#f97316" />{tri(lang, "تکلیف‌ها و برنامهٔ مطالعه", "Assignments & study plan", "Aufgaben & Lernplan", "Ödevler ve çalışma planı")}</h2><p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "جلسه‌های پیشنهادی بر اساس امتحان‌ها هستند؛ قبل از اجرا مرور و در صورت نیاز ویرایششان کنید.", "Suggested sessions use your exam dates. Review and edit them before following the plan.", "Vorgeschlagene Sitzungen basieren auf Prüfungsterminen. Prüfen und bearbeiten Sie sie.", "Öneriler sınav tarihlerine dayanır; uygulamadan önce gözden geçirip düzenleyin.")}</p></div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برنامه برای امتحان:", "Plan for exam:", "Plan für Prüfung:", "Sınav planı:")}</label><select aria-label={tri(lang, "امتحان برنامه", "Exam for study plan", "Prüfung für den Lernplan", "Çalışma planı sınavı")} value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="max-w-64 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "امتحان را انتخاب کن", "Choose an exam", "Prüfung auswählen", "Sınav seç")}</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.course.name} · {dateText(exam.examAt)}</option>)}</select><button type="button" disabled={saving || !selectedExamId} onClick={() => void makePlan()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ background: "rgba(249,115,22,.12)", color: "#f97316" }}><Sparkles size={15} />{saving ? tri(lang, "در حال ساخت…", "Working…", "Wird erstellt…", "Hazırlanıyor…") : tri(lang, "ساخت برنامهٔ ۷روزه", "Build 7-day plan", "7-Tage-Plan erstellen", "7 günlük plan oluştur")}</button></div>
    </div>

    <form onSubmit={addTask} className="mb-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(120px,.8fr)_minmax(130px,1fr)_minmax(205px,1.1fr)_auto]">
      <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tri(lang, "عنوان تکلیف یا جلسه", "Assignment or session title", "Titel der Aufgabe / Sitzung", "Ödev veya oturum başlığı")} className="rounded-lg px-3 py-2 text-sm min-w-0" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} />
      <select value={taskType} onChange={(e) => setTaskType(e.target.value as "assignment" | "study")} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="assignment">{tri(lang, "تکلیف", "Assignment", "Aufgabe", "Ödev")}</option><option value="study">{tri(lang, "جلسهٔ مطالعه", "Study session", "Lerneinheit", "Çalışma oturumu")}</option></select>
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "بدون درس", "No course", "Kein Kurs", "Ders seçme")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
      <label className="min-w-0 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تاریخ و ساعت (اختیاری)", "Date & time (optional)", "Datum und Uhrzeit (optional)", "Tarih ve saat (isteğe bağlı)")}<input type="datetime-local" dir="ltr" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label={tri(lang, "مهلت", "Due date", "Fälligkeitsdatum", "Son tarih")} className="mt-1 block w-full min-w-0 rounded-lg px-2 py-2 text-left text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></label>
      <button disabled={saving || !title.trim()} className="rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}><Plus size={16} className="inline me-1" />{tri(lang, "افزودن", "Add", "Hinzufügen", "Ekle")}</button>
    </form>

    {error && <p role="alert" className="text-sm mb-3" style={{ color: "#dc2626" }}>{error}</p>}
    {!loading && tasks.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: "var(--surface-0)" }}><label className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نمایش بر اساس درس", "Organize by course", "Nach Kurs filtern", "Derse göre filtrele")}</label><select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setShowAll(false); }} aria-label={tri(lang, "فیلتر درس", "Course filter", "Kursfilter", "Ders filtresi")} className="min-w-36 flex-1 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "همهٔ درس‌ها", "All courses", "Alle Kurse", "Tüm dersler")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>{(["open", "completed", "all"] as const).map((filter) => <button type="button" key={filter} onClick={() => { setTaskFilter(filter); setShowAll(false); }} className="rounded-md px-2 py-1.5 text-xs" style={{ background: taskFilter === filter ? "var(--primary)" : "transparent", color: taskFilter === filter ? "white" : "var(--text-secondary)" }}>{filter === "open" ? tri(lang, "درپیش‌رو", "Open", "Offen", "Açık") : filter === "completed" ? tri(lang, "انجام‌شده", "Done", "Erledigt", "Tamamlandı") : tri(lang, "همه", "All", "Alle", "Tümü")}</button>)}</div><span className="text-xs" style={{ color: "var(--text-muted)" }}>{filteredTasks.length} {tri(lang, "مورد", "items", "Einträge", "öğe")}</span></div>}
    {loading ? <div className="py-6 text-center"><Loader2 className="animate-spin inline" /></div> : tasks.length === 0 ? <p className="py-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز تکلیف یا جلسه‌ای نداری؛ می‌توانی دستی اضافه کنی یا از تاریخ امتحان‌ها برنامه بسازی.", "No assignments or sessions yet. Add one or build a plan from exam dates.", "Noch keine Aufgaben oder Sitzungen. Fügen Sie eine hinzu oder erstellen Sie einen Plan.", "Henüz ödev veya oturum yok. Ekleyebilir ya da sınav tarihlerinden plan oluşturabilirsin.")}</p> : filteredTasks.length === 0 ? <p className="py-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برای این فیلتر موردی پیدا نشد.", "No items match this filter.", "Keine Einträge für diesen Filter.", "Bu filtrede öğe yok.")}</p> : <div className="space-y-2">{visibleTasks.map((task) => <div key={task.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "var(--surface-0)", opacity: task.completedAt ? .62 : 1 }}><button type="button" onClick={() => void toggle(task)} aria-label={task.completedAt ? tri(lang, "علامت‌گذاری به‌عنوان انجام‌نشده", "Mark incomplete", "Als offen markieren", "Tamamlanmadı olarak işaretle") : tri(lang, "علامت‌گذاری به‌عنوان انجام‌شده", "Mark complete", "Als erledigt markieren", "Tamamlandı olarak işaretle")} className="mt-0.5 rounded-md border p-1" style={{ borderColor: task.completedAt ? "#16a34a" : "var(--border)", color: "#16a34a" }}>{task.completedAt ? <Check size={14} /> : <span className="block h-3.5 w-3.5" />}</button><div className="min-w-0 flex-1"><div className={`text-sm font-medium ${task.completedAt ? "line-through" : ""}`} style={{ color: "var(--text-primary)" }}>{task.title}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}><span>{task.taskType === "study" ? tri(lang, "مطالعه", "Study", "Lernen", "Çalışma") : tri(lang, "تکلیف", "Assignment", "Aufgabe", "Ödev")}</span>{task.course && <span style={{ color: task.course.color }}>{task.course.name}</span>}{task.dueAt && <span>{dateText(task.dueAt)}</span>}{task.generated && <span>{tri(lang, "پیشنهادی", "Suggested", "Vorgeschlagen", "Önerilen")}</span>}</div>{task.description && <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--text-muted)" }}>{task.description}</p>}</div><button type="button" onClick={() => void remove(task)} aria-label={tri(lang, "حذف", "Delete", "Löschen", "Sil")} className="rounded-md p-1.5 hover:bg-red-500/10" style={{ color: "var(--text-muted)" }}><Trash2 size={15} /></button></div>)}</div>}
    {!loading && filteredTasks.length > 5 && <button type="button" onClick={() => setShowAll((current) => !current)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#f97316" }}>{showAll ? tri(lang, "نمایش کمتر", "Show less", "Weniger anzeigen", "Daha az göster") : tri(lang, `نمایش ${filteredTasks.length - 5} مورد دیگر`, `Show ${filteredTasks.length - 5} more`, `${filteredTasks.length - 5} weitere anzeigen`, `${filteredTasks.length - 5} öğe daha göster`)}<ChevronDown size={14} className={showAll ? "rotate-180" : ""}/></button>}
  </section>;
}
