"use client";

import StudyAnswer from "./StudyAnswer";

import { useEffect, useState } from "react";
import { BookOpenCheck, Loader2, Sparkles } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Course = { id: string; name: string };
const MODES = ["proposal", "outline", "methodology", "literature", "review"] as const;

export default function StudentThesisAssistant({ courses, lang, onSaved }: { courses: Course[]; lang: Lang; onSaved?: () => void | Promise<void> }) {
  const [courseId, setCourseId] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("proposal");
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState(20);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/student/thesis-assist").then((r) => r.json()).then((d) => { if (Number.isInteger(d.credits)) setCredits(d.credits); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  const modeName = (value: string) => value === "proposal" ? tri(lang, "ایده و پروپوزال", "Topic & proposal", "Thema & Exposé", "Konu ve öneri")
    : value === "outline" ? tri(lang, "ساختار فصل‌ها", "Chapter outline", "Kapitelgliederung", "Bölüm taslağı")
      : value === "methodology" ? tri(lang, "روش‌شناسی پژوهش", "Research methodology", "Forschungsmethodik", "Araştırma yöntemi")
        : value === "literature" ? tri(lang, "مرور منابع", "Literature review", "Literaturüberblick", "Literatür taraması")
          : tri(lang, "بازخورد روی متن", "Draft feedback", "Feedback zum Entwurf", "Taslak geri bildirimi");

  async function run(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setAnswer("");
    try {
      const response = await fetch("/api/student/thesis-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, mode, prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "درخواست انجام نشد");
      setAnswer(`${data.answer}\n\n${tri(lang, `ذخیره شد در یادداشت درس · ${data.creditsUsed} اعتبار`, `Saved to course notes · ${data.creditsUsed} credits`, `In Kursnotizen gespeichert · ${data.creditsUsed} Credits`, `Ders notlarına kaydedildi · ${data.creditsUsed} kredi`)}`);
      await onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "درخواست ناموفق بود"); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl p-5 md:p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
    <div className="mb-4 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(139,92,246,.13)", color: "#8b5cf6" }}><BookOpenCheck size={19}/></span><div><h2 className="font-semibold text-lg">{tri(lang, "راهنمای پژوهش، پایان‌نامه و تز", "Thesis & research coach", "Betreuung für Abschlussarbeiten", "Tez ve araştırma danışmanı")}</h2><p className="mt-1 text-xs leading-6" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برای صورت‌بندی سؤال پژوهش، ساختار، روش‌شناسی و بازبینی علمی کمک می‌کند؛ متن ارزیابی‌شده را به‌جای دانشجو نمی‌نویسد و منبع یا داده جعل نمی‌کند.", "Get help with research questions, structure, methods, and feedback. It will not ghostwrite assessed work or invent sources/data.", "Hilfe zu Forschungsfragen, Aufbau und Methodik; keine erfundenen Quellen oder Ghostwriting.", "Araştırma sorusu, yapı ve yöntem desteği; kaynak uydurmaz ve değerlendirilen metni yazmaz.")}</p></div></div>
    <form onSubmit={run} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{tri(lang, "درس / پروژه", "Course / project", "Kurs / Projekt", "Ders / proje")}<select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }}><option value="">{tri(lang, "انتخاب درس", "Select course", "Kurs auswählen", "Ders seç")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="block text-sm">{tri(lang, "نوع کمک پژوهشی", "Research help", "Art der Hilfe", "Yardım türü")}<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }}>{MODES.map((item) => <option key={item} value={item}>{modeName(item)}</option>)}</select></label></div>
      <label className="block text-sm">{tri(lang, "موضوع، سؤال، rubic یا بخشی از پیش‌نویس", "Topic, question, rubric, or draft excerpt", "Thema, Frage, Kriterien oder Textauszug", "Konu, soru, değerlendirme ölçütü veya taslak")}<textarea required minLength={10} maxLength={12000} rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tri(lang, "رشته، مقطع، موضوع و محدودیت‌های استاد را بنویس…", "Include your field, degree level, topic, and instructor requirements…", "Fach, Abschluss, Thema und Vorgaben…", "Alanını, düzeyini, konunu ve danışman koşullarını yaz…")} className="mt-1.5 w-full rounded-lg p-3 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/></label>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium" style={{ color: "#8b5cf6" }}>{loading ? tri(lang, "در حال دریافت هزینه…", "Loading cost…", "Kosten werden geladen…", "Maliyet yükleniyor…") : tri(lang, `هزینهٔ این اجرا: ${credits} اعتبار · فقط در صورت پاسخ موفق`, `Cost: ${credits} credits · charged only on success`, `Kosten: ${credits} Credits · nur bei Erfolg`, `Maliyet: ${credits} kredi · yalnızca başarılı olursa`)}</p><button disabled={busy || loading || !courseId || prompt.trim().length < 10} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white disabled:opacity-50" style={{ background: "#8b5cf6" }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{tri(lang, "شروع راهنمایی پژوهش", "Start research coaching", "Betreuung starten", "Danışmanlığı başlat")}</button></div>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}{answer && <div className="mt-4 whitespace-pre-wrap rounded-xl p-4 text-sm leading-7" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><StudyAnswer>{answer}</StudyAnswer></div>}
  </section>;
}
