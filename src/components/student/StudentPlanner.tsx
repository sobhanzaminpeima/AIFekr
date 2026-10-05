"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ChevronDown, Loader2, Plus, Sparkles, Trash2, Pencil, BookOpen } from "lucide-react";
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

export default function StudentPlanner({ courses, exams, lang, calendar, onAddExam, onStudy }: { courses: Course[]; exams: Exam[]; lang: Lang; calendar: "persian" | "gregory"; onAddExam: () => void; onStudy: (courseId: string) => void }) {
  const [notice, setNotice] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
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
  const upcomingExams = exams.filter(exam => new Date(exam.examAt).getTime() > Date.now());
  useEffect(() => {
    if (selectedExamId && exams.some((exam) => exam.id === selectedExamId && new Date(exam.examAt).getTime() > Date.now())) return;
    setSelectedExamId(exams.find(exam => new Date(exam.examAt).getTime() > Date.now())?.id || "");
  }, [exams, selectedExamId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTasks((await request<{ tasks: Task[] }>("/api/student/tasks")).tasks); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load tasks"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const submittedDueAt = String(new FormData(event.currentTarget).get("dueAt") || "");
    setSaving(true); setError("");
    try {
      await request("/api/student/tasks", { method: "POST", body: JSON.stringify({ title, courseId: courseId || null, dueAt: submittedDueAt ? new Date(submittedDueAt).toISOString() : null, taskType }) });
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
    if (!window.confirm(tri(lang, `«${task.title}» حذف شود؟`, `Delete “${task.title}”?`, `„${task.title}“ löschen?`, `“${task.title}” silinsin mi?`))) return;
    setError("");
    try { await request(`/api/student/tasks/${task.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete task"); }
  }

  async function makePlan() {
    setSaving(true); setError("");
    try {
      const result = await request<{ created: number; message: string }>("/api/student/study-plan", { method: "POST", body: JSON.stringify({ examId: selectedExamId }) });
      setCourseFilter(exams.find(exam => exam.id === selectedExamId)?.course.id || ""); setTaskFilter("open"); setShowAll(false);
      await load();
      setNotice(result.created ? tri(lang, `${result.created} جلسه آماده شد؛ از اولین جلسه شروع کن. زمان‌ها را می‌توانی تغییر بدهی.`, `${result.created} sessions ready. Start with the first; times are editable.`, `${result.created} Sitzungen bereit. Starte mit der ersten; Zeiten sind änderbar.`, `${result.created} oturum hazır. İlkinden başla; zamanları değiştirebilirsin.`) : tri(lang, "جلسهٔ جدیدی اضافه نشد. برنامهٔ موجود را ببین؛ اگر امتحان خیلی نزدیک است، یک جلسه دستی اضافه کن.", "No new sessions added. Check the existing plan; add a manual session if the exam is very close.", "Keine neuen Sitzungen. Bestehenden Plan prüfen; bei naher Prüfung manuell ergänzen.", "Yeni oturum eklenmedi. Mevcut planı kontrol et; sınav çok yakınsa elle oturum ekle."));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create study plan"); }
    finally { setSaving(false); }
  }

  function startEdit(task: Task) {
    setEditingTask(task); setEditTitle(task.title);
    const date = task.dueAt ? new Date(task.dueAt) : null;
    setEditDueAt(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingTask) return;
    const form = new FormData(event.currentTarget);
    const submittedDueAt = String(form.get("editDueAt") || "");
    setSaving(true); setError("");
    try {
      await request(`/api/student/tasks/${editingTask.id}`, { method: "PATCH", body: JSON.stringify({ title: editTitle, dueAt: submittedDueAt ? new Date(submittedDueAt).toISOString() : null }) });
      setEditingTask(null); await load(); setNotice(tri(lang, "جلسه ذخیره شد", "Session saved", "Sitzung gespeichert", "Oturum kaydedildi"));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save session"); }
    finally { setSaving(false); }
  }

  const baseLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const dateText = (value: string) => new Intl.DateTimeFormat(calendar === "persian" ? `${baseLocale}-u-ca-persian` : `${baseLocale}-u-ca-gregory`, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const filteredTasks = tasks.filter((task) => (!courseFilter || task.course?.id === courseFilter) && (taskFilter === "all" || (taskFilter === "completed" ? !!task.completedAt : !task.completedAt)));
  const visibleTasks = showAll ? filteredTasks : filteredTasks.slice(0, 5);
  const panel: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };

  return <section className="rounded-2xl p-5 md:p-6 mb-7" style={panel}>
    <div className="mb-5 rounded-xl p-4" style={{ background: "var(--surface-0)" }}>
      <h2 className="font-semibold">{tri(lang, "تا امتحان، قدم‌به‌قدم", "Step by step to your exam", "Schritt für Schritt zur Prüfung", "Sınava adım adım")}</h2>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{tri(lang, "۱. تاریخ امتحان را ثبت کن ← ۲. برنامه بساز ← ۳. هر جلسه را مطالعه کن و تیک بزن", "1. Add your exam date → 2. Build a plan → 3. Study each session and mark it done", "1. Prüfungstermin → 2. Plan erstellen → 3. Lernen und abhaken", "1. Sınav tarihini ekle → 2. Plan oluştur → 3. Çalış ve tamamlandı işaretle")}</p>
      {!upcomingExams.length && <button type="button" onClick={onAddExam} className="mt-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white">{tri(lang, "قدم اول: ثبت امتحان", "First step: add an exam", "Erster Schritt: Prüfung hinzufügen", "İlk adım: sınav ekle")}</button>}
    </div>
    <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
      <div><h2 className="font-semibold text-lg flex gap-2 items-center"><CalendarClock size={19} color="#f97316" />{tri(lang, "تکلیف‌ها و برنامهٔ مطالعه", "Assignments & study plan", "Aufgaben & Lernplan", "Ödevler ve çalışma planı")}</h2><p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "جلسه‌های پیشنهادی بر اساس امتحان‌ها هستند؛ قبل از اجرا مرور و در صورت نیاز ویرایششان کنید.", "Suggested sessions use your exam dates. Review and edit them before following the plan.", "Vorgeschlagene Sitzungen basieren auf Prüfungsterminen. Prüfen und bearbeiten Sie sie.", "Öneriler sınav tarihlerine dayanır; uygulamadan önce gözden geçirip düzenleyin.")}</p></div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برنامه برای امتحان:", "Plan for exam:", "Plan für Prüfung:", "Sınav planı:")}</label><select aria-label={tri(lang, "امتحان برنامه", "Exam for study plan", "Prüfung für den Lernplan", "Çalışma planı sınavı")} value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="max-w-64 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "امتحان را انتخاب کن", "Choose an exam", "Prüfung auswählen", "Sınav seç")}</option>{upcomingExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.course.name} · {dateText(exam.examAt)}</option>)}</select><button type="button" disabled={saving || !selectedExamId} onClick={() => void makePlan()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ background: "rgba(249,115,22,.12)", color: "#f97316" }}><Sparkles size={15} />{saving ? tri(lang, "در حال ساخت…", "Working…", "Wird erstellt…", "Hazırlanıyor…") : tri(lang, "ساخت برنامهٔ ۷روزه", "Build 7-day plan", "7-Tage-Plan erstellen", "7 günlük plan oluştur")}</button></div>
    </div>

    <details className="mb-4 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}><summary className="cursor-pointer text-sm font-medium">{tri(lang, "جلسه یا تکلیف را خودم اضافه کنم", "Add my own session or assignment", "Eigene Sitzung oder Aufgabe hinzufügen", "Kendi oturumumu veya ödevimi ekle")}</summary>
    <form onSubmit={addTask} className="mb-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(120px,.8fr)_minmax(130px,1fr)_minmax(205px,1.1fr)_auto]">
      <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={tri(lang, "عنوان تکلیف یا جلسه", "Task or session title", "Titel der Aufgabe", "Görev başlığı")} placeholder={tri(lang, "عنوان تکلیف یا جلسه", "Assignment or session title", "Titel der Aufgabe / Sitzung", "Ödev veya oturum başlığı")} className="rounded-lg px-3 py-2 text-sm min-w-0" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} />
      <select value={taskType} onChange={(e) => setTaskType(e.target.value as "assignment" | "study")} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="assignment">{tri(lang, "تکلیف", "Assignment", "Aufgabe", "Ödev")}</option><option value="study">{tri(lang, "جلسهٔ مطالعه", "Study session", "Lerneinheit", "Çalışma oturumu")}</option></select>
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "بدون درس", "No course", "Kein Kurs", "Ders seçme")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
      <label className="min-w-0 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تاریخ و ساعت (اختیاری)", "Date & time (optional)", "Datum und Uhrzeit (optional)", "Tarih ve saat (isteğe bağlı)")}<input name="dueAt" type="datetime-local" dir="ltr" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label={tri(lang, "مهلت", "Due date", "Fälligkeitsdatum", "Son tarih")} className="mt-1 block w-full min-w-0 rounded-lg px-2 py-2 text-left text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></label>
      <button disabled={saving || !title.trim()} className="rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}><Plus size={16} className="inline me-1" />{tri(lang, "افزودن", "Add", "Hinzufügen", "Ekle")}</button>
    </form></details>

    {notice && <p role="status" className="mb-3 rounded-xl p-3 text-sm" style={{ background: "rgba(34,197,94,.1)", color: "var(--text-primary)" }}>{notice}</p>}
    {error && <p role="alert" className="text-sm mb-3" style={{ color: "#dc2626" }}>{error}</p>}
    {!loading && tasks.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: "var(--surface-0)" }}><label className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نمایش بر اساس درس", "Organize by course", "Nach Kurs filtern", "Derse göre filtrele")}</label><select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setShowAll(false); }} aria-label={tri(lang, "فیلتر درس", "Course filter", "Kursfilter", "Ders filtresi")} className="min-w-36 flex-1 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "همهٔ درس‌ها", "All courses", "Alle Kurse", "Tüm dersler")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>{(["open", "completed", "all"] as const).map((filter) => <button type="button" key={filter} onClick={() => { setTaskFilter(filter); setShowAll(false); }} className="rounded-md px-2 py-1.5 text-xs" style={{ background: taskFilter === filter ? "var(--primary)" : "transparent", color: taskFilter === filter ? "white" : "var(--text-secondary)" }}>{filter === "open" ? tri(lang, "درپیش‌رو", "Open", "Offen", "Açık") : filter === "completed" ? tri(lang, "انجام‌شده", "Done", "Erledigt", "Tamamlandı") : tri(lang, "همه", "All", "Alle", "Tümü")}</button>)}</div><span className="text-xs" style={{ color: "var(--text-muted)" }}>{filteredTasks.length} {tri(lang, "مورد", "items", "Einträge", "öğe")}</span></div>}
    {loading ? <div className="py-6 text-center"><Loader2 className="animate-spin inline" /></div> : tasks.length === 0 ? <p className="py-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز تکلیف یا جلسه‌ای نداری؛ می‌توانی دستی اضافه کنی یا از تاریخ امتحان‌ها برنامه بسازی.", "No assignments or sessions yet. Add one or build a plan from exam dates.", "Noch keine Aufgaben oder Sitzungen. Fügen Sie eine hinzu oder erstellen Sie einen Plan.", "Henüz ödev veya oturum yok. Ekleyebilir ya da sınav tarihlerinden plan oluşturabilirsin.")}</p> : filteredTasks.length === 0 ? <p className="py-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برای این فیلتر موردی پیدا نشد.", "No items match this filter.", "Keine Einträge für diesen Filter.", "Bu filtrede öğe yok.")}</p> : <div className="space-y-2">{visibleTasks.map((task) => <div key={task.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "var(--surface-0)", opacity: task.completedAt ? .62 : 1 }}><button type="button" onClick={() => void toggle(task)} aria-label={task.completedAt ? tri(lang, "علامت‌گذاری به‌عنوان انجام‌نشده", "Mark incomplete", "Als offen markieren", "Tamamlanmadı olarak işaretle") : tri(lang, "علامت‌گذاری به‌عنوان انجام‌شده", "Mark complete", "Als erledigt markieren", "Tamamlandı olarak işaretle")} className="mt-0.5 rounded-md border p-1" style={{ borderColor: task.completedAt ? "#16a34a" : "var(--border)", color: "#16a34a" }}>{task.completedAt ? <Check size={14} /> : <span className="block h-3.5 w-3.5" />}</button><div className="min-w-0 flex-1"><div className={`text-sm font-medium ${task.completedAt ? "line-through" : ""}`} style={{ color: "var(--text-primary)" }}>{task.title}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}><span>{task.taskType === "study" ? tri(lang, "مطالعه", "Study", "Lernen", "Çalışma") : tri(lang, "تکلیف", "Assignment", "Aufgabe", "Ödev")}</span>{task.course && <span style={{ color: task.course.color }}>{task.course.name}</span>}{task.dueAt && <span>{dateText(task.dueAt)}</span>}{task.generated && <span>{tri(lang, "پیشنهادی", "Suggested", "Vorgeschlagen", "Önerilen")}</span>}</div>{!task.completedAt && task.course && <button type="button" onClick={() => onStudy(task.course!.id)} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-orange-500"><BookOpen size={14}/>{tri(lang, "شروع مطالعهٔ این درس", "Start studying this course", "Diesen Kurs lernen", "Bu derse çalışmaya başla")}</button>}{task.description && <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--text-muted)" }}>{task.description}</p>}</div><div className="flex shrink-0 flex-col gap-1"><button type="button" disabled={saving} onClick={() => startEdit(task)} aria-label={tri(lang, "ویرایش عنوان و زمان", "Edit title and time", "Titel und Zeit bearbeiten", "Başlık ve zamanı düzenle")} className="rounded-md p-1.5"><Pencil size={15}/></button><button type="button" onClick={() => void remove(task)} aria-label={tri(lang, "حذف", "Delete", "Löschen", "Sil")} className="rounded-md p-1.5 hover:bg-red-500/10" style={{ color: "var(--text-muted)" }}><Trash2 size={15} /></button></div></div>)}</div>}
    {editingTask && <form onSubmit={saveEdit} className="mt-4 space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}><h3 className="text-sm font-semibold">{tri(lang, "تغییر جلسه", "Edit session", "Sitzung bearbeiten", "Oturumu düzenle")}</h3><label className="block text-sm">{tri(lang, "عنوان", "Title", "Titel", "Başlık")}<input autoFocus required maxLength={200} value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3"/></label><label className="block text-sm">{tri(lang, "زمان (اختیاری)", "Time (optional)", "Zeit (optional)", "Zaman (isteğe bağlı)")}<input name="editDueAt" type="datetime-local" dir="ltr" value={editDueAt} onChange={e => setEditDueAt(e.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3"/></label><div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-orange-500 px-4 py-3 text-sm text-white">{tri(lang, "ذخیره", "Save", "Speichern", "Kaydet")}</button><button type="button" onClick={() => setEditingTask(null)} className="rounded-lg border px-4 py-3 text-sm">{tri(lang, "انصراف", "Cancel", "Abbrechen", "İptal")}</button></div></form>}
    {!loading && filteredTasks.length > 5 && <button type="button" onClick={() => setShowAll((current) => !current)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#f97316" }}>{showAll ? tri(lang, "نمایش کمتر", "Show less", "Weniger anzeigen", "Daha az göster") : tri(lang, `نمایش ${filteredTasks.length - 5} مورد دیگر`, `Show ${filteredTasks.length - 5} more`, `${filteredTasks.length - 5} weitere anzeigen`, `${filteredTasks.length - 5} öğe daha göster`)}<ChevronDown size={14} className={showAll ? "rotate-180" : ""}/></button>}
  </section>;
}
