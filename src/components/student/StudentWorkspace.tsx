"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Sparkles, FileText, CalendarDays, Layers3, ArrowLeft, ArrowRight, GraduationCap, Loader2, Upload, X, Brain, CheckCircle2, Briefcase, LockKeyhole, Pencil, Trash2, MessageCircle, CalendarRange } from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import StudentPlanner from "@/components/student/StudentPlanner";
import StudentAssignmentHelper from "@/components/student/StudentAssignmentHelper";
import StudentProfileCard from "@/components/student/StudentProfileCard";

type Course = { id: string; name: string; courseCode: string | null; institution: string | null; term: string | null; instructor: string | null; description: string | null; color: string; _count: { materials: number; notes: number; flashcards: number; exams: number; quizzes: number }; exams: { examAt: string; title: string }[] };
type Exam = { id: string; title: string; examAt: string; course: { id: string; name: string; color: string } };
type Note = { id: string; title: string; updatedAt: string; course: { id: string; name: string } };
type BusinessPackage = { planCode: "CRM_SOLO" | "CRM_TEAM"; name: string; nameEn: string; price: number; priceUsd: number | null; market: string; duration: number; features: string; featuresEn?: string };

const shell: React.CSSProperties = { minHeight: "100%", padding: "32px clamp(16px, 4vw, 48px)", color: "var(--text-primary)" };
const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function dateLabel(value: string, lang: Lang, calendar: "persian" | "gregory") {
  const locale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, { month: "short", day: "numeric" }).format(new Date(value));
}

export default function StudentWorkspace() {
  const { lang } = useTranslation();
  const router = useRouter();
  const rtl = lang === "fa";
  const Back = rtl ? ArrowRight : ArrowLeft;
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCourse, setShowCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "", courseCode: "", institution: "", term: "", instructor: "", description: "" });
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [showMaterial, setShowMaterial] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examAt, setExamAt] = useState("");
  const [showExam, setShowExam] = useState(false);
  const [showFlashcard, setShowFlashcard] = useState(false);
  const [flashcardQuestion, setFlashcardQuestion] = useState("");
  const [flashcardAnswer, setFlashcardAnswer] = useState("");
  const [flashcards, setFlashcards] = useState<{ id: string; question: string; answer: string; masteryLevel: number; reviewCount: number; nextReviewAt: string | null }[]>([]);
  const [activeCard, setActiveCard] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quiz, setQuiz] = useState<{ id: string; title: string; timeLimitSeconds?: number | null; attemptToken?: string | null; questions: { question: string; topic: string; explanation: string; options: string[] }[] } | null>(null);
  const [quizRemaining, setQuizRemaining] = useState<number | null>(null);
  const quizDeadline = useRef<number | null>(null);
  const quizSubmitted = useRef(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; weakTopics: string[]; review: { correct: boolean; explanation: string; correctIndex: number }[] } | null>(null);
  const [tab, setTab] = useState<"courses" | "notes" | "exams">("courses");
  const [businessPackages, setBusinessPackages] = useState<BusinessPackage[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [crmActive, setCrmActive] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<"persian" | "gregory">(lang === "fa" ? "persian" : "gregory");

  useEffect(() => {
    const saved = window.localStorage.getItem("student-calendar");
    if (saved === "persian" || saved === "gregory") setCalendar(saved);
  }, []);

  function changeCalendar(value: "persian" | "gregory") {
    setCalendar(value); window.localStorage.setItem("student-calendar", value);
  }

  const t = useMemo(() => ({
    title: tri(lang, "دانشگاه هوش مصنوعی شما", "Your AI University", "Deine KI-Universität", "Yapay Zekâ Üniversiten"),
    subtitle: tri(lang, "درس‌ها، جزوه‌ها و آمادگی امتحان در یک فضای شخصی", "Courses, materials and exam prep in one personal workspace", "Kurse, Materialien und Prüfungsvorbereitung an einem Ort", "Dersler, kaynaklar ve sınav hazırlığı tek yerde"),
    courses: tri(lang, "درس‌های من", "My courses", "Meine Kurse", "Derslerim"),
    addCourse: tri(lang, "درس جدید", "Add course", "Kurs hinzufügen", "Ders ekle"),
    addMaterial: tri(lang, "افزودن جزوه", "Add material", "Material hinzufügen", "Kaynak ekle"),
    ask: tri(lang, "از جزوه‌ها بپرس", "Ask your materials", "Materialien fragen", "Kaynaklara sor"),
    flashcards: tri(lang, "ساخت فلش‌کارت", "Generate flashcards", "Lernkarten erstellen", "Kart oluştur"),
    quiz: tri(lang, "آزمون تمرینی", "Practice quiz", "Übungstest", "Deneme sınavı"),
    notes: tri(lang, "یادداشت‌ها", "Notes", "Notizen", "Notlar"),
    exams: tri(lang, "امتحان‌های پیش‌رو", "Upcoming exams", "Nächste Prüfungen", "Yaklaşan sınavlar"),
    materials: tri(lang, "منبع", "sources", "Quellen", "kaynak"),
    empty: tri(lang, "هنوز درسی اضافه نکرده‌ای. اولین درس را بساز تا فضای مطالعه‌ات شکل بگیرد.", "No courses yet. Add your first course to set up your study space.", "Noch keine Kurse. Füge deinen ersten Kurs hinzu.", "Henüz ders yok. İlk dersini ekle."),
    noSource: tri(lang, "برای فعال‌شدن دستیار مطالعه، به درس یک جزوه اضافه کن.", "Add course material to enable the study assistant.", "Füge Kursmaterial hinzu, um den Lernassistenten zu nutzen.", "Çalışma asistanı için ders kaynağı ekle."),
    save: tri(lang, "ذخیره", "Save", "Speichern", "Kaydet"),
    cancel: tri(lang, "انصراف", "Cancel", "Abbrechen", "İptal"),
    loading: tri(lang, "در حال بارگذاری…", "Loading…", "Lädt…", "Yükleniyor…"),
    addExam: tri(lang, "ثبت امتحان", "Add exam", "Prüfung hinzufügen", "Sınav ekle"),
  }), [lang]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [courseData, examData, noteData] = await Promise.all([
        api<{ courses: Course[] }>("/api/student/courses"),
        api<{ exams: Exam[] }>("/api/student/exams"),
        api<{ notes: Note[] }>("/api/student/notes"),
      ]);
      setCourses(courseData.courses); setExams(examData.exams); setNotes(noteData.notes);
      setSelectedCourse((current) => current && courseData.courses.some((course) => course.id === current) ? current : courseData.courses[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedCourse) { setFlashcards([]); return; }
    let cancelled = false;
    api<{ flashcards: typeof flashcards }>(`/api/student/flashcards?courseId=${selectedCourse}`)
      .then((data) => { if (!cancelled) { setFlashcards(data.flashcards); setActiveCard(0); setRevealed(false); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "خطا در دریافت فلش‌کارت‌ها"); });
    return () => { cancelled = true; };
  }, [selectedCourse]);

  useEffect(() => {
    Promise.all([
      api<{ packages: BusinessPackage[] }>("/api/packages").catch(() => ({ packages: [] as BusinessPackage[] })),
      api<{ user?: { crmPlan?: string; crmPlanExpiry?: string | null; industryPackId?: string | null } }>("/api/auth/me").catch(() => ({ user: undefined })),
    ]).then(([packageData, accountData]) => {
      setBusinessPackages(packageData.packages.filter((p) => (p.planCode === "CRM_SOLO" || p.planCode === "CRM_TEAM") && p.market !== "INTL"));
      const user = accountData.user;
      setCrmActive(!!user?.crmPlan && user.crmPlan !== "NONE" && (!user.crmPlanExpiry || new Date(user.crmPlanExpiry).getTime() > Date.now()));
      setActiveIndustry(!!user?.industryPackId);
    });
  }, []);

  function startNewCourse() {
    setEditingCourse(null); setCourseForm({ name: "", courseCode: "", institution: "", term: "", instructor: "", description: "" }); setShowCourse(true);
  }

  function startEditCourse(course: Course) {
    setEditingCourse(course.id); setCourseForm({ name: course.name, courseCode: course.courseCode || "", institution: course.institution || "", term: course.term || "", instructor: course.instructor || "", description: course.description || "" }); setShowCourse(true);
  }

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const data = await api<{ course: Course }>(editingCourse ? `/api/student/courses/${editingCourse}` : "/api/student/courses", { method: editingCourse ? "PATCH" : "POST", body: JSON.stringify(courseForm) });
      setCourses((rows) => editingCourse ? rows.map((course) => course.id === editingCourse ? data.course : course) : [data.course, ...rows]);
      setSelectedCourse(data.course.id); setShowCourse(false); setEditingCourse(null);
      setNotice(editingCourse ? tri(lang, "اطلاعات درس ذخیره شد", "Course updated", "Kurs aktualisiert", "Ders güncellendi") : tri(lang, "درس ساخته شد", "Course created", "Kurs erstellt", "Ders oluşturuldu"));
    }
    catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function deleteCourse(course: Course) {
    const confirmed = window.confirm(tri(lang, `حذف «${course.name}» همه جزوه‌ها، یادداشت‌ها و آزمون‌های این درس را هم پاک می‌کند. ادامه می‌دهی؟`, `Delete “${course.name}” and its materials, notes, and exams?`, `„${course.name}“ samt Materialien, Notizen und Prüfungen löschen?`, `“${course.name}” ve kaynak, not ve sınavlarını sil?`));
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      await api(`/api/student/courses/${course.id}`, { method: "DELETE" });
      const nextCourses = courses.filter((item) => item.id !== course.id);
      setCourses(nextCourses); setSelectedCourse((selected) => selected === course.id ? nextCourses[0]?.id || "" : selected);
      setNotice(tri(lang, "درس و محتوای وابسته حذف شد", "Course and related content deleted", "Kurs und zugehörige Inhalte gelöscht", "Ders ve ilişkili içerik silindi"));
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault(); if (!selectedCourse) return; setBusy(true); setError("");
    try {
      let result: { material: { title: string } };
      if (materialFile) {
        const form = new FormData(); form.set("courseId", selectedCourse); form.set("title", materialTitle); form.set("file", materialFile);
        result = await api("/api/student/materials", { method: "POST", body: form });
      } else {
        result = await api("/api/student/materials", { method: "POST", body: JSON.stringify({ courseId: selectedCourse, title: materialTitle, content: materialText }) });
      }
      setShowMaterial(false); setMaterialTitle(""); setMaterialText(""); setMaterialFile(null); setNotice(tri(lang, `منبع «${result.material.title}» اضافه شد`, `Added “${result.material.title}”`, `„${result.material.title}“ hinzugefügt`, `“${result.material.title}” eklendi`)); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault(); if (!selectedCourse) return; setBusy(true); setError("");
    try { await api("/api/student/notes", { method: "POST", body: JSON.stringify({ courseId: selectedCourse, title: noteTitle, content: noteText }) }); setShowNote(false); setNoteTitle(""); setNoteText(""); setNotice(tri(lang, "یادداشت ذخیره شد", "Note saved", "Notiz gespeichert", "Not kaydedildi")); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function addExam(e: React.FormEvent) {
    e.preventDefault(); if (!selectedCourse) return; setBusy(true); setError("");
    try { await api("/api/student/exams", { method: "POST", body: JSON.stringify({ courseId: selectedCourse, title: examTitle, examAt: new Date(examAt).toISOString() }) }); setShowExam(false); setExamTitle(""); setExamAt(""); setNotice(tri(lang, "امتحان ثبت شد", "Exam scheduled", "Prüfung eingetragen", "Sınav planlandı")); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function addManualFlashcard(e: React.FormEvent) {
    e.preventDefault(); if (!selectedCourse) return; setBusy(true); setError("");
    try {
      await api("/api/student/flashcards", { method: "POST", body: JSON.stringify({ courseId: selectedCourse, question: flashcardQuestion, answer: flashcardAnswer }) });
      setFlashcardQuestion(""); setFlashcardAnswer(""); setShowFlashcard(false);
      const result = await api<{ flashcards: typeof flashcards }>(`/api/student/flashcards?courseId=${selectedCourse}`); setFlashcards(result.flashcards);
      setNotice(tri(lang, "فلش‌کارت ذخیره شد", "Flashcard saved", "Lernkarte gespeichert", "Kart kaydedildi"));
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function rateFlashcard(rating: "hard" | "good" | "easy") {
    const current = flashcards[activeCard]; if (!current) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ masteryLevel: number; reviewCount: number; nextReviewAt: string }>(`/api/student/flashcards/${current.id}`, { method: "PATCH", body: JSON.stringify({ rating }) });
      setFlashcards((items) => items.map((item) => item.id === current.id ? { ...item, ...result } : item));
      setActiveCard((index) => (index + 1) % flashcards.length); setRevealed(false);
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function runAI(action: "ask" | "flashcards" | "quiz") {
    if (!selectedCourse) return; setBusy(true); setError(""); setNotice(""); setAnswer(""); setQuizResult(null);
    try {
      const prompt = action === "ask" ? question : action === "flashcards" ? "Create review flashcards for the key concepts" : "Create a course review quiz covering the key concepts";
      const data = await api<{ answer?: string; quiz?: typeof quiz; creditsUsed: number; created?: number }>("/api/student/ai", { method: "POST", body: JSON.stringify({ courseId: selectedCourse, action, prompt, count: 8, ...(action === "quiz" ? { timeLimitSeconds: 600 } : {}) }) });
      if (action === "ask") { setAnswer(data.answer || ""); setNotice(tri(lang, `هزینه: ${data.creditsUsed} اعتبار · پاسخ در یادداشت‌های درس ذخیره شد`, `${data.creditsUsed} credits · answer saved to course notes`, `${data.creditsUsed} Credits · Antwort in Kursnotizen gespeichert`, `${data.creditsUsed} kredi · yanıt ders notlarına kaydedildi`)); const saved = await api<{ notes: Note[] }>(`/api/student/notes?courseId=${selectedCourse}`); setNotes(saved.notes); }
      if (action === "flashcards") { setNotice(tri(lang, `${data.created} فلش‌کارت ساخته شد · ${data.creditsUsed} اعتبار`, `${data.created} flashcards created · ${data.creditsUsed} credits`, `${data.created} Lernkarten erstellt · ${data.creditsUsed} Credits`, `${data.created} kart oluşturuldu · ${data.creditsUsed} kredi`)); const d = await api<{ flashcards: typeof flashcards }>(`/api/student/flashcards?courseId=${selectedCourse}`); setFlashcards(d.flashcards); setActiveCard(0); setRevealed(false); }
      if (action === "quiz" && data.quiz) { const newQuiz = data.quiz as NonNullable<typeof quiz>; setQuiz(newQuiz); setQuizAnswers([]); setQuizResult(null); quizSubmitted.current = false; setQuizRemaining(newQuiz.timeLimitSeconds || null); quizDeadline.current = newQuiz.timeLimitSeconds ? Date.now() + newQuiz.timeLimitSeconds * 1000 : null; setNotice(tri(lang, `آزمون ساخته شد · ${data.creditsUsed} اعتبار`, `Timed quiz created · ${data.creditsUsed} credits`, `Zeitprüfung erstellt · ${data.creditsUsed} Credits`, `Süreli sınav oluşturuldu · ${data.creditsUsed} kredi`)); }
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  const submitQuiz = useCallback(async (expired = false) => {
    if (!quiz || quizSubmitted.current || (!expired && (quizAnswers.length !== quiz.questions.length || quizAnswers.some((answer) => answer === undefined)))) return;
    setBusy(true); setError(""); quizSubmitted.current = true;
    try { const answers = quiz.questions.map((_, index) => quizAnswers[index] ?? null); const data = await api<{ attempt: NonNullable<typeof quizResult> }>(`/api/student/quizzes/${quiz.id}`, { method: "POST", body: JSON.stringify({ answers, attemptToken: quiz.attemptToken }) }); setQuizResult(data.attempt); }
    catch (err) { quizSubmitted.current = false; setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }, [quiz, quizAnswers]);

  useEffect(() => {
    if (!quiz || !quiz.timeLimitSeconds || quizDeadline.current === null || quizResult) return;
    const tick = () => setQuizRemaining(Math.max(0, Math.ceil((quizDeadline.current! - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [quiz, quizResult]);

  useEffect(() => {
    if (quizRemaining !== 0 || !quiz || quizResult || quizSubmitted.current) return;
    void submitQuiz(true);
  }, [quizRemaining, quiz, quizResult, submitQuiz]);

  async function buyBusinessAddon(planCode: "CRM_SOLO" | "CRM_TEAM") {
    setPurchasing(planCode); setError("");
    try {
      const data = await api<{ paymentUrl?: string; activatedByWallet?: boolean }>("/api/payment/create", { method: "POST", body: JSON.stringify({ plan: planCode, period: billingPeriod, gateway: lang === "fa" ? "zarinpal" : "usdt_trc20" }) });
      if (data.activatedByWallet) { setCrmActive(true); setNotice(tri(lang, "اشتراک CRM با موجودی کیف پول فعال شد؛ حالا صنعت کسب‌وکارت را انتخاب کن.", "CRM is active via wallet. Choose your business industry next.", "CRM wurde mit dem Guthaben aktiviert. Wähle jetzt deine Branche.", "CRM cüzdan bakiyesiyle etkinleştirildi. Şimdi sektörünü seç.")); router.refresh(); }
      else if (data.paymentUrl) window.location.assign(data.paymentUrl);
      else throw new Error(tri(lang, "درگاه پرداخت پاسخ معتبری نداد", "Payment provider returned no checkout URL", "Kein Checkout-Link vom Zahlungsanbieter", "Ödeme sağlayıcısı bir bağlantı döndürmedi"));
    } catch (err) { setError(err instanceof Error ? err.message : "خطا در شروع پرداخت"); }
    finally { setPurchasing(null); }
  }

  const activeCourse = courses.find((course) => course.id === selectedCourse);

  return <main style={shell} dir={rtl ? "rtl" : "ltr"}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header className="flex flex-wrap items-center justify-between gap-5 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(249,115,22,.14)", color: "#f97316" }}><GraduationCap size={30} /></div>
          <div><h1 className="text-3xl font-bold tracking-tight">{t.title}</h1><p className="mt-1" style={{ color: "var(--text-secondary)" }}>{t.subtitle}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => changeCalendar(calendar === "persian" ? "gregory" : "persian")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><CalendarRange size={16} />{calendar === "persian" ? tri(lang, "تقویم شمسی", "Persian calendar", "Persischer Kalender", "İran takvimi") : tri(lang, "تقویم میلادی", "Gregorian calendar", "Gregorianischer Kalender", "Miladi takvim")}</button><Link href={selectedCourse ? `/student/chat?courseId=${encodeURIComponent(selectedCourse)}` : "/student/chat"} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white" style={{ background: "#f97316" }}><MessageCircle size={16} />{tri(lang, "گفتگوی درسی جدید", "New study chat", "Neuer Lernchat", "Yeni çalışma sohbeti")}</Link><Link href="/home" className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><Back size={16} />{tri(lang, "بازگشت به داشبورد", "Back to dashboard", "Zum Dashboard", "Panele dön")}</Link></div>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,.12)", color: "#dc2626" }}>{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(34,197,94,.12)", color: "#15803d" }}>{notice}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        {[
          { label: t.courses, value: courses.length, icon: BookOpen, color: "#f97316" },
          { label: tri(lang, "منابع درسی", "Course materials", "Kursmaterial", "Ders kaynakları"), value: courses.reduce((n, c) => n + c._count.materials, 0), icon: FileText, color: "#0ea5e9" },
          { label: t.notes, value: notes.length, icon: Layers3, color: "#8b5cf6" },
          { label: t.exams, value: exams.length, icon: CalendarDays, color: "#10b981" },
        ].map(({ label, value, icon: Icon, color }) => <div key={label} style={{ ...card, padding: 18 }}><Icon size={19} color={color} /><div className="mt-3 text-2xl font-bold">{value}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{label}</div></div>)}
      </div>

      <StudentProfileCard lang={lang} />
      <StudentPlanner courses={courses.map(({ id, name }) => ({ id, name }))} exams={exams} lang={lang} calendar={calendar} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)] gap-6 items-start">
        <section>
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">{t.courses}</h2><button onClick={startNewCourse} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#f97316" }}><Plus size={17} />{t.addCourse}</button></div>
          {loading ? <div className="py-16 text-center" style={{ color: "var(--text-secondary)" }}><Loader2 className="animate-spin inline" /> <span className="ms-2">{t.loading}</span></div> : courses.length === 0 ? <div style={{ ...card, padding: 36, textAlign: "center" }}><BookOpen size={34} color="#f97316" className="mx-auto mb-3"/><div className="font-medium">{t.empty}</div><button className="mt-4 rounded-xl px-4 py-2 text-white" style={{ background: "#f97316" }} onClick={startNewCourse}>{t.addCourse}</button></div> : <div className="grid sm:grid-cols-2 gap-4">
            {courses.map((course) => <button key={course.id} onClick={() => { setSelectedCourse(course.id); setQuiz(null); setQuizResult(null); setAnswer(""); }} className="text-start p-5 transition-all" style={{ ...card, borderColor: selectedCourse === course.id ? course.color : "var(--border)", boxShadow: selectedCourse === course.id ? `0 0 0 1px ${course.color}` : undefined }}>
              <div className="flex items-start justify-between"><div className="min-w-0"><div className="font-semibold text-lg truncate">{course.name}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{[course.courseCode, course.term].filter(Boolean).join(" · ")}</div>{course.instructor && <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{course.instructor}</div>}</div><span className="w-3 h-3 rounded-full mt-2" style={{ background: course.color }} /></div>
              {course.description && <p className="mt-3 text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>{course.description}</p>}
              <div className="flex flex-wrap gap-3 mt-5 text-xs" style={{ color: "var(--text-secondary)" }}><span>{course._count.materials} {t.materials}</span><span>{course._count.notes} {t.notes}</span><span>{course._count.flashcards} {t.flashcards}</span>{course.exams[0] && <span>{dateLabel(course.exams[0].examAt, lang, calendar)}</span>}</div>
            </button>)}
          </div>}

          {activeCourse && <div className="mt-6" style={{ ...card, padding: "clamp(18px,3vw,28px)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5"><div><div className="text-xs uppercase tracking-wide" style={{ color: "#f97316" }}>{tri(lang, "فضای درس", "COURSE WORKSPACE", "KURSRAUM", "DERS ALANI")}</div><h2 className="text-2xl font-bold mt-1">{activeCourse.name}</h2><p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{[activeCourse.institution, activeCourse.courseCode, activeCourse.term].filter(Boolean).join(" · ")}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => startEditCourse(activeCourse)} aria-label={tri(lang, "ویرایش درس", "Edit course", "Kurs bearbeiten", "Dersi düzenle")} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: "var(--border)" }}><Pencil size={15} className="inline me-1"/>{tri(lang, "ویرایش", "Edit", "Bearbeiten", "Düzenle")}</button><button onClick={() => void deleteCourse(activeCourse)} disabled={busy} aria-label={tri(lang, "حذف درس", "Delete course", "Kurs löschen", "Dersi sil")} className="rounded-lg px-3 py-2 text-sm border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "#dc2626" }}><Trash2 size={15} className="inline me-1"/>{tri(lang, "حذف", "Delete", "Löschen", "Sil")}</button><button onClick={() => setShowMaterial(true)} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: "var(--border)" }}><Upload size={15} className="inline me-1"/>{t.addMaterial}</button><button onClick={() => setShowNote(true)} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: "var(--border)" }}><FileText size={15} className="inline me-1"/>{tri(lang, "یادداشت جدید", "New note", "Neue Notiz", "Yeni not")}</button><button onClick={() => setShowExam(true)} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: "var(--border)" }}><CalendarDays size={15} className="inline me-1"/>{t.addExam}</button><button onClick={() => setShowFlashcard(true)} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: "var(--border)" }}><Layers3 size={15} className="inline me-1"/>{tri(lang, "فلش‌کارت دستی", "Add flashcard", "Lernkarte hinzufügen", "Kart ekle")}</button></div></div>
            {activeCourse._count.materials === 0 ? <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.noSource}</p> : <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{activeCourse._count.materials} {tri(lang, "منبع آمادهٔ مطالعه", "sources ready for study", "Quellen bereit", "kaynak hazır")}</p>}
            <div className="flex gap-2 mb-3"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void runAI("ask"); } }} placeholder={tri(lang, "مثلاً مفهوم اصلی فصل را توضیح بده…", "e.g. Explain the main idea in chapter 2…", "z. B. Erkläre das Hauptkonzept in Kapitel 2…", "örn. 2. bölümün ana fikrini açıkla…")} className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} /><button disabled={busy || activeCourse._count.materials === 0 || !question.trim()} onClick={() => void runAI("ask")} title={tri(lang, "هزینه حداکثر ۵ اعتبار · هزینه واقعی پس از موفقیت", "Up to 5 credits · actual cost shown on success", "Max. 5 Credits · tatsächliche Kosten nach Erfolg", "En fazla 5 kredi · gerçek maliyet başarıdan sonra")} aria-label={tri(lang, "پرسش از AI · حداکثر ۵ اعتبار", "Ask AI · up to 5 credits", "KI fragen · max. 5 Credits", "Yapay zekâya sor · en fazla 5 kredi")} className="rounded-xl px-4 text-white disabled:opacity-50" style={{ background: "#f97316" }}>{busy ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>}</button></div>
            <div className="flex flex-wrap gap-2"><button disabled={busy || activeCourse._count.materials === 0} onClick={() => void runAI("flashcards")} className="rounded-lg px-3 py-2 text-sm border disabled:opacity-50" style={{ borderColor: "var(--border)" }}><Layers3 size={15} className="inline me-1"/>{t.flashcards} · 8 · {tri(lang, "حداکثر ۵ اعتبار", "≤5 credits", "max. 5 Credits", "en fazla 5 kredi")}</button><button disabled={busy || activeCourse._count.materials === 0} onClick={() => void runAI("quiz")} className="rounded-lg px-3 py-2 text-sm border disabled:opacity-50" style={{ borderColor: "var(--border)" }}><Brain size={15} className="inline me-1"/>{t.quiz} · 8 · {tri(lang, "حداکثر ۵ اعتبار", "≤5 credits", "max. 5 Credits", "en fazla 5 kredi")}</button><span className="text-xs self-center ms-auto" style={{ color: "var(--text-secondary)" }}>{tri(lang, "عدد واقعی هزینه بعد از موفقیت نمایش داده می‌شود", "Actual credits are shown after success", "Tatsächliche Credits nach Erfolg", "Gerçek kredi miktarı işlem sonrası gösterilir")}</span></div>
            {answer && <div className="mt-5 rounded-xl p-4 whitespace-pre-wrap text-sm leading-7" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><div className="font-semibold mb-2 flex items-center gap-2"><Sparkles size={15} color="#f97316"/>{tri(lang, "پاسخ بر اساس منابع درس", "Source-grounded answer", "Quellenbasierte Antwort", "Kaynak temelli yanıt")}</div>{answer}</div>}
            {flashcards.length > 0 && <div className="mt-5 rounded-xl p-5" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><div className="flex justify-between text-xs mb-3"><span>{t.flashcards} · {tri(lang, `تسلط ${flashcards[activeCard]?.masteryLevel || 0}/5`, `Mastery ${flashcards[activeCard]?.masteryLevel || 0}/5`, `Lernstand ${flashcards[activeCard]?.masteryLevel || 0}/5`, `Ustalık ${flashcards[activeCard]?.masteryLevel || 0}/5`)}</span><span>{activeCard + 1} / {flashcards.length}</span></div><button onClick={() => setRevealed(!revealed)} className="w-full min-h-24 text-lg font-medium" aria-label={tri(lang, "نمایش یا پنهان‌کردن پاسخ", "Reveal or hide answer", "Antwort zeigen oder ausblenden", "Yanıtı göster veya gizle")}>{revealed ? flashcards[activeCard]?.answer : flashcards[activeCard]?.question}</button><div className="flex flex-wrap justify-between gap-2 mt-3"><button className="text-sm" onClick={() => { setActiveCard((n) => (n - 1 + flashcards.length) % flashcards.length); setRevealed(false); }}>{tri(lang, "قبلی", "Previous", "Zurück", "Önceki")}</button><div className="flex gap-2"><button disabled={busy} onClick={() => void rateFlashcard("hard")} className="rounded-lg px-3 py-1.5 text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{tri(lang, "سخت بود · فردا مرور", "Hard · review tomorrow", "Schwer · morgen wiederholen", "Zor · yarın tekrar")}</button><button disabled={busy} onClick={() => void rateFlashcard("good")} className="rounded-lg px-3 py-1.5 text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{tri(lang, "خوب بود", "Good", "Gut", "İyi")}</button><button disabled={busy} onClick={() => void rateFlashcard("easy")} className="rounded-lg px-3 py-1.5 text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{tri(lang, "آسان", "Easy", "Einfach", "Kolay")}</button></div></div></div>}
            {quiz && <div className="mt-5 rounded-xl p-5" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><div className="flex items-center justify-between gap-3 mb-4"><div className="font-semibold text-lg">{quiz.title}</div>{quiz.timeLimitSeconds && quizRemaining !== null && <div role="timer" aria-live="off" className="rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums" style={{ color: quizRemaining < 60 ? "#dc2626" : "var(--text-primary)", background: quizRemaining < 60 ? "rgba(239,68,68,.12)" : "var(--surface-1)" }}>{Math.floor(quizRemaining / 60).toString().padStart(2, "0")}:{(quizRemaining % 60).toString().padStart(2, "0")}</div>}</div>{quiz.questions.map((item, qi) => <div key={qi} className="mb-5"><div className="font-medium mb-2">{qi + 1}. {item.question}</div><div className="grid sm:grid-cols-2 gap-2">{item.options.map((option, oi) => <button key={oi} onClick={() => setQuizAnswers((prev) => { const next = [...prev]; next[qi] = oi; return next; })} className="text-start rounded-lg px-3 py-2 text-sm" style={{ background: quizAnswers[qi] === oi ? "rgba(249,115,22,.16)" : "var(--surface-1)", border: `1px solid ${quizAnswers[qi] === oi ? "#f97316" : "var(--border)"}` }}>{option}</button>)}</div></div>)}<button disabled={busy || quizAnswers.length !== quiz.questions.length || quizAnswers.some((x) => x === undefined)} onClick={() => void submitQuiz()} className="rounded-lg px-4 py-2 text-white disabled:opacity-50" style={{ background: "#f97316" }}>{tri(lang, "ثبت پاسخ‌ها", "Submit answers", "Antworten abgeben", "Yanıtları gönder")}</button>{quizResult && <div className="mt-4"><div className="font-semibold flex gap-2 items-center"><CheckCircle2 color="#16a34a"/>{tri(lang, `نتیجه: ${quizResult.score} از ${quizResult.total}`, `Score: ${quizResult.score} / ${quizResult.total}`, `Ergebnis: ${quizResult.score} / ${quizResult.total}`, `Sonuç: ${quizResult.score} / ${quizResult.total}`)}</div>{quizResult.weakTopics.length > 0 && <p className="mt-2 text-sm">{tri(lang, "نیاز به مرور:", "Review these topics:", "Wiederholen:", "Tekrar konuları:")} {quizResult.weakTopics.join("، ")}</p>}</div>}</div>}
          </div>}

          {activeCourse && <StudentAssignmentHelper courseId={activeCourse.id} lang={lang} />}

          <section id="business-upgrade" className="mt-6 rounded-2xl p-5 md:p-6" style={{ background: "linear-gradient(135deg,rgba(59,130,246,.11),rgba(249,115,22,.1))", border: "1px solid rgba(59,130,246,.24)" }}>
            <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(59,130,246,.15)", color: "#3b82f6" }}>{crmActive ? <Briefcase size={19}/> : <LockKeyhole size={19}/>}</span><div><h2 className="font-semibold">{tri(lang, "دانشجو هستی و بیزنس هم داری؟", "A student with a business too?", "Studierst du und hast ein Unternehmen?", "Öğrenci misin, işletmen de mi var?")}</h2><p className="text-sm mt-1 leading-6" style={{ color: "var(--text-secondary)" }}>{tri(lang, "ابزارهای CRM و ایجنت‌های املاک برای همهٔ دانشجوها نمایش داده نمی‌شوند. با خرید افزونهٔ CRM می‌توانی بخش بیزنسی را در همین پورتال فعال کنی؛ سپس صنعت خود مثل املاک را انتخاب کن.", "CRM and real-estate agents stay out of the student portal until you choose a business add-on. Buy CRM to activate business tools here, then select an industry such as real estate.", "CRM- und Immobilien-Tools bleiben ausgeblendet, bis du ein Business-Add-on wählst. Mit CRM aktivierst du Business-Funktionen und wählst anschließend eine Branche wie Immobilien.", "CRM ve emlak araçları, işletme paketi seçilene kadar öğrenci portalında görünmez. CRM satın alıp işletme araçlarını açabilir, ardından emlak gibi bir sektör seçebilirsin.")}</p></div></div>
            {crmActive ? <div className="mt-4 rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><p className="text-sm font-medium" style={{ color: "#16a34a" }}>{activeIndustry ? tri(lang, "دسترسی بیزنسی و صنعت انتخابی فعال است.", "Business access and an industry are active.", "Businesszugang und Branche sind aktiv.", "İşletme erişimi ve sektör etkin.") : tri(lang, "CRM فعال است؛ یک صنعت انتخاب کن تا ابزارهای مرتبط در منو ظاهر شوند.", "CRM is active. Choose an industry to reveal its tools in the menu.", "CRM ist aktiv. Wähle eine Branche, um passende Tools im Menü zu sehen.", "CRM etkin. İlgili araçları menüde görmek için sektör seç.")}</p>{!activeIndustry && <Link href="/industry" className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white" style={{ background: "#3b82f6" }}>{tri(lang, "انتخاب صنعت کسب‌وکار", "Choose business industry", "Branche auswählen", "İşletme sektörünü seç")}<ArrowRight size={15}/></Link>}</div> : <>
              <div className="mt-4 flex flex-wrap gap-2">{(["monthly", "quarterly", "semiannual", "annual"] as const).map((period) => <button key={period} onClick={() => setBillingPeriod(period)} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: billingPeriod === period ? "#3b82f6" : "var(--surface-1)", color: billingPeriod === period ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)" }}>{period === "monthly" ? tri(lang, "ماهانه", "Monthly", "Monatlich", "Aylık") : period === "quarterly" ? tri(lang, "۳ ماهه", "3 months", "3 Monate", "3 ay") : period === "semiannual" ? tri(lang, "۶ ماهه", "6 months", "6 Monate", "6 ay") : tri(lang, "سالانه", "Annual", "Jährlich", "Yıllık")}</button>)}</div>
              <div className="mt-3 grid md:grid-cols-2 gap-3">{businessPackages.map((pkg) => {
                const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[billingPeriod];
                const discount = { monthly: 0, quarterly: .05, semiannual: .1, annual: 2 / 12 }[billingPeriod];
                const price = lang === "fa" ? Math.round(pkg.price / 10 * months * (1 - discount)).toLocaleString("fa-IR") + " تومان" : pkg.priceUsd != null ? "$" + ((pkg.priceUsd / 100) * months * (1 - discount)).toFixed(2) : tri(lang, "قیمت بین‌الملل تعریف نشده", "International price unavailable", "Internationaler Preis fehlt", "Uluslararası fiyat tanımlı değil");
                const name = lang === "fa" ? pkg.name : pkg.nameEn;
                const features = ((lang === "fa" ? pkg.features : pkg.featuresEn || pkg.features) || "").split("\n").filter(Boolean).slice(0, 3);
                return <div key={pkg.planCode} className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><div className="flex justify-between items-center gap-2"><div className="font-semibold">{name}</div><div className="text-sm font-bold" style={{ color: "#3b82f6" }}>{price}</div></div><ul className="mt-2 space-y-1">{features.map((feature) => <li key={feature} className="text-xs" style={{ color: "var(--text-secondary)" }}>✓ {feature}</li>)}</ul><button disabled={!!purchasing || (lang !== "fa" && pkg.priceUsd == null)} onClick={() => void buyBusinessAddon(pkg.planCode)} className="mt-3 w-full rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#3b82f6" }}>{purchasing === pkg.planCode ? tri(lang, "در حال اتصال به درگاه…", "Opening checkout…", "Weiterleitung zur Kasse…", "Ödeme sayfası açılıyor…") : tri(lang, "فعال‌سازی بیزنس", "Unlock business tools", "Business-Tools freischalten", "İşletme araçlarını aç")}</button></div>;
              })}</div>
              {businessPackages.length === 0 && <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پلن CRM هنوز در پکیج‌های فعال ادمین تعریف نشده است.", "No active CRM add-on is configured in Admin → Packages.", "Im Admin sind keine aktiven CRM-Tarife konfiguriert.", "Yönetici paketlerinde etkin CRM planı tanımlı değil.")}</p>}
            </>}
            <div className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پس از پرداخت موفق، منوی کسب‌وکار در پورتال ظاهر می‌شود؛ فعال‌سازی صنعت نیازمند CRM فعال است.", "After payment succeeds, business navigation appears in your portal. Industry activation requires active CRM.", "Nach erfolgreicher Zahlung erscheint die Business-Navigation. Eine Branche setzt aktives CRM voraus.", "Ödeme başarıyla tamamlanınca işletme menüsü görünür. Sektör etkinleştirmek için CRM etkin olmalı.")}</div>
          </section>
        </section>

        <aside>
          <div style={{ ...card, overflow: "hidden" }}><div className="flex border-b" style={{ borderColor: "var(--border)" }}>{(["exams", "notes"] as const).map((key) => <button key={key} onClick={() => setTab(key)} className="flex-1 px-4 py-3 text-sm" style={{ color: tab === key ? "#f97316" : "var(--text-secondary)", borderBottom: tab === key ? "2px solid #f97316" : "2px solid transparent" }}>{key === "exams" ? t.exams : t.notes}</button>)}</div>
            {tab === "exams" ? <div className="p-4">{exams.length === 0 ? <p className="text-sm py-5 text-center" style={{ color: "var(--text-secondary)" }}>{tri(lang, "امتحانی ثبت نشده", "No exams scheduled", "Keine Prüfung geplant", "Sınav planlanmadı")}</p> : exams.map((exam) => <div key={exam.id} className="flex gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}><div className="rounded-lg px-2 py-1 text-center text-xs" style={{ background: `${exam.course.color}18`, color: exam.course.color }}>{dateLabel(exam.examAt, lang, calendar)}</div><div><div className="text-sm font-medium">{exam.title}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{exam.course.name}</div></div></div>)}</div> : <div className="p-4">{notes.length === 0 ? <p className="text-sm py-5 text-center" style={{ color: "var(--text-secondary)" }}>{tri(lang, "یادداشتی ثبت نشده", "No notes yet", "Noch keine Notizen", "Henüz not yok")}</p> : notes.slice(0, 8).map((note) => <button key={note.id} onClick={() => setSelectedCourse(note.course.id)} className="block w-full text-start py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}><div className="text-sm font-medium truncate">{note.title}</div><div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{note.course.name} · {dateLabel(note.updatedAt, lang, calendar)}</div></button>)}</div>}</div>
          <div className="mt-4 rounded-2xl p-5" style={{ background: "linear-gradient(140deg,rgba(249,115,22,.15),rgba(139,92,246,.1))", border: "1px solid rgba(249,115,22,.18)" }}><div className="font-semibold flex items-center gap-2"><Sparkles size={17} color="#f97316"/>{tri(lang, "یادگیری متکی به منبع", "Grounded study AI", "Quellenbasiertes Lernen", "Kaynak temelli öğrenme")}</div><p className="text-sm leading-6 mt-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پاسخ‌ها، فلش‌کارت‌ها و آزمون‌ها از جزوه‌های خودت ساخته می‌شوند. اگر پاسخ در منابع نباشد، دستیار باید این محدودیت را بگوید.", "Answers, cards and quizzes are generated from your own materials. If the sources do not support an answer, the assistant should say so.", "Antworten, Karten und Tests basieren auf deinen Materialien. Fehlt die Information, weist der Assistent darauf hin.", "Yanıtlar ve testler kendi kaynaklarından üretilir. Bilgi kaynaklarda yoksa asistan bunu belirtir.")}</p></div>
        </aside>
      </div>
    </div>

    {showCourse && <Modal title={editingCourse ? tri(lang, "ویرایش درس", "Edit course", "Kurs bearbeiten", "Dersi düzenle") : t.addCourse} onClose={() => setShowCourse(false)}><form onSubmit={saveCourse} className="space-y-3"><Field label={tri(lang, "نام درس", "Course name", "Kursname", "Ders adı")} value={courseForm.name} onChange={(name) => setCourseForm((form) => ({ ...form, name }))} required autoFocus/><Field label={tri(lang, "کد درس", "Course code", "Kursnummer", "Ders kodu")} value={courseForm.courseCode} onChange={(courseCode) => setCourseForm((form) => ({ ...form, courseCode }))}/><Field label={tri(lang, "دانشگاه / دپارتمان", "University / department", "Universität / Fachbereich", "Üniversite / bölüm")} value={courseForm.institution} onChange={(institution) => setCourseForm((form) => ({ ...form, institution }))}/><div className="grid sm:grid-cols-2 gap-3"><Field label={tri(lang, "ترم", "Term", "Semester", "Dönem")} value={courseForm.term} onChange={(term) => setCourseForm((form) => ({ ...form, term }))}/><Field label={tri(lang, "استاد", "Instructor", "Dozent/in", "Eğitmen")} value={courseForm.instructor} onChange={(instructor) => setCourseForm((form) => ({ ...form, instructor }))}/></div><label className="block text-sm">{tri(lang, "توضیحات", "Description", "Beschreibung", "Açıklama")}<textarea value={courseForm.description} onChange={(e) => setCourseForm((form) => ({ ...form, description: e.target.value }))} rows={3} maxLength={2000} className="w-full rounded-xl p-3 mt-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label><button disabled={busy} className="w-full rounded-xl p-3 text-white" style={{ background: "#f97316" }}>{busy ? t.loading : t.save}</button></form></Modal>}
    {showFlashcard && <Modal title={tri(lang, "فلش‌کارت جدید", "New flashcard", "Neue Lernkarte", "Yeni bilgi kartı")} onClose={() => setShowFlashcard(false)}><form onSubmit={addManualFlashcard} className="space-y-4"><label className="block text-sm">{tri(lang, "پرسش / روی کارت", "Question / front", "Frage / Vorderseite", "Soru / ön yüz")}<textarea required maxLength={1000} value={flashcardQuestion} onChange={(e) => setFlashcardQuestion(e.target.value)} rows={3} className="w-full rounded-xl p-3 mt-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label><label className="block text-sm">{tri(lang, "پاسخ / پشت کارت", "Answer / back", "Antwort / Rückseite", "Yanıt / arka yüz")}<textarea required maxLength={2000} value={flashcardAnswer} onChange={(e) => setFlashcardAnswer(e.target.value)} rows={4} className="w-full rounded-xl p-3 mt-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label><button disabled={busy} className="w-full rounded-xl p-3 text-white disabled:opacity-50" style={{ background: "#f97316" }}>{busy ? t.loading : t.save}</button></form></Modal>}
    {showMaterial && <Modal title={t.addMaterial} onClose={() => setShowMaterial(false)}><form onSubmit={addMaterial} className="space-y-4"><Field label={tri(lang, "عنوان جزوه", "Material title", "Materialtitel", "Kaynak başlığı")} value={materialTitle} onChange={setMaterialTitle} required/><label className="block text-sm">{tri(lang, "فایل PDF/DOCX/PPTX (حداکثر ۱۰ مگابایت)", "PDF/DOCX/PPTX file (max 10MB)", "PDF/DOCX/PPTX (max. 10 MB)", "PDF/DOCX/PPTX (en fazla 10 MB)")}<input className="block w-full mt-2 text-sm" type="file" accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}/></label><div className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "یا متن را وارد کن", "or paste text", "oder Text einfügen", "veya metin yapıştır")}</div><textarea value={materialText} onChange={(e) => setMaterialText(e.target.value)} rows={6} maxLength={100000} placeholder={tri(lang, "متن جزوه یا یادداشت‌های کلاس…", "Paste lecture notes or source text…", "Vorlesungsnotizen einfügen…", "Ders notlarını yapıştır…")} className="w-full rounded-xl p-3 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/><div className="flex gap-2"><button type="button" onClick={() => setShowMaterial(false)} className="flex-1 rounded-xl p-3 border" style={{ borderColor: "var(--border)" }}>{t.cancel}</button><button disabled={busy || (!materialFile && !materialText.trim())} className="flex-1 rounded-xl p-3 text-white disabled:opacity-50" style={{ background: "#f97316" }}>{busy ? t.loading : t.save}</button></div></form></Modal>}
    {showNote && <Modal title={tri(lang, "یادداشت جدید", "New note", "Neue Notiz", "Yeni not")} onClose={() => setShowNote(false)}><form onSubmit={addNote} className="space-y-4"><Field label={tri(lang, "عنوان", "Title", "Titel", "Başlık")} value={noteTitle} onChange={setNoteTitle} required/><textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={7} maxLength={20000} required placeholder={tri(lang, "یادداشت درس…", "Study note…", "Lernnotiz…", "Ders notu…")} className="w-full rounded-xl p-3 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/><button disabled={busy} className="w-full rounded-xl p-3 text-white" style={{ background: "#f97316" }}>{busy ? t.loading : t.save}</button></form></Modal>}
    {showExam && <Modal title={t.addExam} onClose={() => setShowExam(false)}><form onSubmit={addExam} className="space-y-4"><Field label={tri(lang, "عنوان امتحان", "Exam title", "Prüfungstitel", "Sınav adı")} value={examTitle} onChange={setExamTitle} required/><label className="block text-sm">{tri(lang, "تاریخ و ساعت", "Date and time", "Datum und Uhrzeit", "Tarih ve saat")}<input type="datetime-local" value={examAt} onChange={(e) => setExamAt(e.target.value)} required className="w-full rounded-xl p-3 mt-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label><button disabled={busy} className="w-full rounded-xl p-3 text-white" style={{ background: "#f97316" }}>{busy ? t.loading : t.save}</button></form></Modal>}
  </main>;
}

function Field({ label, value, onChange, required, autoFocus }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; autoFocus?: boolean }) {
  return <label className="block text-sm">{label}<input value={value} onChange={(e) => onChange(e.target.value)} required={required} autoFocus={autoFocus} maxLength={200} className="w-full rounded-xl p-3 mt-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.58)" }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><div className="flex justify-between items-center mb-5"><h2 className="font-semibold text-lg">{title}</h2><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>{children}</div></div>;
}
