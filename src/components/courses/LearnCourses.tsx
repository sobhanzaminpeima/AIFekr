"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation, tri } from "@/lib/i18n";
import type { publicCourseContent } from "@/lib/courses/content";
type Course = { id: string; title: string; fieldOfStudy: string; description: string; language: string };
type Progress = { completed: string; quizPassed: string; completedAt: string | null; certificateId: string | null };
type Content = ReturnType<typeof publicCourseContent>;
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await response.json(); if (!response.ok) throw new Error(body.code || body.error); return body;
}
export default function LearnCourses() {
  const { lang } = useTranslation(); const t = (fa: string, en: string, de: string, tr: string) => tri(lang,fa,en,de,tr);
  const search = useSearchParams(); const selected = search.get("course"); const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]); const [course, setCourse] = useState<(Course & { content: Content }) | null>(null); const [progress,setProgress] = useState<Progress | null>(null);
  const [lessonId,setLessonId] = useState("0:0"); const [answers,setAnswers] = useState<number[]>([]); const [result,setResult] = useState<{ correct: number; total: number; passed: boolean; feedback: { explanation: string; correctIndex: number }[] } | null>(null);
  const [error,setError] = useState(""); const [busy,setBusy] = useState(false); const [query,setQuery] = useState("");
  const [loading,setLoading] = useState(true);
  useEffect(() => { api("/api/learn/courses").then(data => setCourses(data.courses)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    let active = true; setError(""); setResult(null); setAnswers([]); setCourse(null); setProgress(null);
    if (selected) api(`/api/learn/courses/${selected}`).then(data => {
      if (!active) return; setCourse(data.course); setProgress(data.progress);
      const completed: string[] = data.progress ? JSON.parse(data.progress.completed) : [];
      const ids = data.course.content.chapters.flatMap((chapter: Content["chapters"][number],ci: number) => chapter.lessons.map((_,li) => `${ci}:${li}`));
      setLessonId(ids.find((id: string) => !completed.includes(id)) || ids[0]);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [selected]);
  const completed: string[] = progress ? JSON.parse(progress.completed) : [];
  const passed: string[] = progress ? JSON.parse(progress.quizPassed) : [];
  const lessons = course?.content.chapters.flatMap((chapter,ci) => chapter.lessons.map((lesson,li) => ({ ...lesson,id:`${ci}:${li}`,chapter:chapter.title }))) || [];
  const lesson = lessons.find(item => item.id === lessonId);
  function choose(id: string) { setLessonId(id); setResult(null); setAnswers([]); setError(""); }
  async function update(action: "complete" | "quiz") {
    if (!course || !lesson) return; setBusy(true); setError("");
    try { const data = await api(`/api/learn/courses/${course.id}/progress`, { method:"POST", body:JSON.stringify({ action,lessonId, ...(action === "quiz" ? { answers } : {}) }) }); setProgress(data.progress); if (data.result) setResult(data.result); }
    catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); } finally { setBusy(false); }
  }
  return <div dir={lang === "fa" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" style={{ color:"var(--text-primary)" }}>
    <header className="rounded-2xl border border-orange-400/30 bg-orange-400/5 p-6"><h1 className="text-2xl font-bold">{t("دوره‌های دانشگاه AIFekr", "AIFekr learning courses", "AIFekr-Lernkurse", "AIFekr öğrenme kursları")}</h1><p className="mt-3 text-sm leading-7">{t("درس بخوان، تمرین کن و پیشرفتت را ادامه بده؛ باز کردن دوره، آزمون‌های عادی و گواهی پایان دوره اعتبار تولید مصرف نمی‌کنند.", "Learn, practice and continue your progress. Opening courses, normal quizzes and completion certificates do not use generation credits.", "Lerne, übe und setze deinen Fortschritt fort. Kurse, normale Quizfragen und Abschlusszertifikate verbrauchen keine Generierungs-Credits.", "Öğren, alıştırma yap ve ilerlemene devam et. Kurs açma, normal quizler ve tamamlama sertifikaları oluşturma kredisi kullanmaz.")}</p><Link href="/student" className="mt-3 inline-block underline">{t("فضای دانشجویی", "Student workspace", "Studierendenbereich", "Öğrenci alanı")}</Link></header>
    {error && <p role="alert" className="rounded-xl border border-red-400 p-4">{error === "PASS_LESSON_QUIZ_FIRST" ? t("ابتدا آزمون همین درس را با موفقیت انجام بده", "Pass this lesson's quiz first", "Zuerst das Quiz dieser Lektion bestehen", "Önce bu dersin quizini geç") : error === "ANSWER_ALL_QUESTIONS" ? t("به همهٔ سؤال‌ها پاسخ بده", "Answer all questions", "Alle Fragen beantworten", "Tüm soruları cevapla") : t("دوره فعلاً در دسترس نیست یا درخواست انجام نشد؛ صفحه را دوباره باز کن و دسترسی دانشجویی را بررسی کن", "Course unavailable or request failed. Reopen the page and check student access", "Kurs nicht verfügbar oder Anfrage fehlgeschlagen. Seite erneut öffnen und Zugang prüfen", "Kurs kullanılamıyor veya istek başarısız. Sayfayı yeniden aç ve öğrenci erişimini kontrol et")}</p>}
    {loading && <p role="status">{t("در حال بارگذاری دوره‌ها…", "Loading courses…", "Kurse werden geladen…", "Kurslar yükleniyor…")}</p>}
    {!selected ? <><input aria-label={t("جستجوی دوره", "Search courses", "Kurse suchen", "Kurs ara")} className="min-h-12 w-full rounded-xl border border-slate-500/30 bg-transparent p-3" value={query} onChange={e => setQuery(e.target.value)}/><div className="grid gap-4 sm:grid-cols-2">{courses.filter(item => `${item.title} ${item.fieldOfStudy}`.toLowerCase().includes(query.toLowerCase())).map(item => <Link key={item.id} href={`/learn?course=${item.id}`} className="rounded-2xl border border-slate-500/30 p-5"><p className="text-sm text-orange-400">{item.fieldOfStudy} · {item.language.toUpperCase()}</p><h2 className="mt-2 text-xl font-bold">{item.title}</h2><p className="mt-3 line-clamp-3 text-sm">{item.description}</p><p className="mt-4 font-semibold">{t("شروع / ادامهٔ یادگیری", "Start / continue learning", "Lernen starten / fortsetzen", "Öğrenmeye başla / devam et")} →</p></Link>)}</div>{!courses.length && !error && <p>{t("هنوز دوره‌ای منتشر نشده", "No courses published yet", "Noch keine Kurse veröffentlicht", "Henüz yayımlanmış kurs yok")}</p>}</> : course && <>
      <button className="rounded-xl border px-4 py-3" onClick={() => router.replace("/learn")}>← {t("همهٔ دوره‌ها", "All courses", "Alle Kurse", "Tüm kurslar")}</button>
      <h2 className="text-2xl font-bold">{course.title}</h2><p className="whitespace-pre-wrap leading-8">{course.content.overview}</p><ul className="list-inside list-disc space-y-2">{course.content.objectives.map((objective,i) => <li key={i}>{objective}</li>)}</ul>
      <div className="rounded-xl border border-slate-500/30 p-4"><p>{completed.length} / {lessons.length} · {t("درس تکمیل‌شده", "lessons completed", "Lektionen abgeschlossen", "ders tamamlandı")}</p><progress className="mt-3 h-3 w-full accent-orange-500" value={completed.length} max={lessons.length}/></div>
      <div className="flex flex-wrap gap-2">{lessons.map(item => <button key={item.id} onClick={() => choose(item.id)} className={`max-w-full rounded-xl border px-4 py-3 text-sm ${lessonId === item.id ? "border-orange-500" : "border-slate-500/30"}`}>{completed.includes(item.id) ? "✓ " : ""}{item.title}</button>)}</div>
      {lesson && <section dir={course.language === "fa" ? "rtl" : "ltr"} className="space-y-5 rounded-2xl border border-slate-500/30 p-5"><p className="text-orange-400">{lesson.chapter}</p><h3 className="text-xl font-bold">{lesson.title}</h3><p className="whitespace-pre-wrap leading-8">{lesson.content}</p><p className="rounded-xl bg-orange-400/5 p-4 leading-8">{lesson.activity}</p>
        {lesson.quiz.map((question,qi) => <fieldset key={qi} className="space-y-3"><legend className="mb-3 font-semibold">{qi+1}. {question.question}</legend>{question.options.map((option,oi) => <label key={oi} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-500/30 p-3"><input type="radio" name={`question-${qi}`} checked={answers[qi] === oi} onChange={() => { setResult(null); setAnswers(previous => { const next = [...previous]; next[qi] = oi; return next; }); }}/>{option}</label>)}{result && <p className="text-sm leading-7">{result.feedback[qi].explanation}</p>}</fieldset>)}
        <div className="flex flex-wrap gap-3"><button disabled={busy || lesson.quiz.some((_,i) => !Number.isInteger(answers[i]))} className="min-h-12 rounded-xl border px-5 py-3 disabled:opacity-50" onClick={() => void update("quiz")}>{t("بررسی آزمون — رایگان", "Check quiz · free", "Quiz prüfen · kostenlos", "Quizi kontrol et · ücretsiz")}</button><button disabled={busy || !passed.includes(lesson.id) || completed.includes(lesson.id)} className="min-h-12 rounded-xl bg-orange-500 px-5 py-3 text-white disabled:opacity-50" onClick={() => void update("complete")}>{completed.includes(lesson.id) ? t("درس تکمیل شد", "Lesson completed", "Lektion abgeschlossen", "Ders tamamlandı") : t("تکمیل درس — رایگان", "Complete lesson · free", "Lektion abschließen · kostenlos", "Dersi tamamla · ücretsiz")}</button></div>
        {result && <p role="status">{result.correct} / {result.total} · {result.passed ? t("قبول شدی؛ درس را تکمیل کن", "Passed. Complete the lesson", "Bestanden. Lektion abschließen", "Geçtin. Dersi tamamla") : t("دوباره تمرین کن؛ هزینه‌ای ندارد", "Try again; no charge", "Erneut versuchen; kostenlos", "Tekrar dene; ücretsiz")}</p>}
      </section>}
      <section className="rounded-2xl border border-slate-500/30 p-5"><h3 className="text-xl font-bold">{course.content.finalProject.title}</h3><p className="mt-3 whitespace-pre-wrap leading-8">{course.content.finalProject.instructions}</p><ul className="mt-4 list-inside list-disc space-y-2">{course.content.finalProject.rubric.map((item,i) => <li key={i}>{item}</li>)}</ul></section>
      {progress?.certificateId && <section className="rounded-2xl border border-emerald-400/30 p-5"><h3 className="text-xl font-bold">{t("دوره را کامل کردی!", "Course completed!", "Kurs abgeschlossen!", "Kurs tamamlandı!")}</h3><a href={`/api/learn/courses/${course.id}/certificate`} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 py-3 text-white">{t("دانلود گواهی پایان دوره — رایگان", "Download completion certificate · free", "Abschlusszertifikat herunterladen · kostenlos", "Tamamlama sertifikasını indir · ücretsiz")}</a></section>}
    </>}
  </div>;
}
