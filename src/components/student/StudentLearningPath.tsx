"use client";

import { BookOpen, Upload, MessageCircle, Layers3, Brain, Check } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  courseName?: string;
  hasMaterials: boolean;
  busy: boolean;
  onCreate: () => void;
  onUpload: () => void;
  onLearn: () => void;
  onReview: () => void;
  onQuiz: () => void;
};

export default function StudentLearningPath({ lang, courseName, hasMaterials, busy, onCreate, onUpload, onLearn, onReview, onQuiz }: Props) {
  const step = !courseName ? 0 : !hasMaterials ? 1 : 2;
  const steps = [
    tri(lang, "درست را انتخاب کن", "Choose a course", "Kurs wählen", "Ders seç"),
    tri(lang, "جزوه یا ویس اضافه کن", "Add notes or audio", "Material oder Audio hinzufügen", "Not veya ses ekle"),
    tri(lang, "یادگیری را شروع کن", "Start learning", "Lernen starten", "Öğrenmeye başla"),
  ];
  return <section className="student-learning-path mb-5 rounded-2xl p-5" style={{ background: "linear-gradient(125deg,rgba(249,115,22,.13),rgba(14,165,233,.07))", border: "1px solid var(--border)" }} aria-label={tri(lang, "مسیر یادگیری", "Learning path", "Lernpfad", "Öğrenme yolu")}>
    <ol className="mb-5 grid grid-cols-3 gap-2">
      {steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-2 text-xs leading-5 sm:flex-row sm:items-center" style={{ color: i === step ? "var(--text-primary)" : "var(--text-secondary)" }}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-bold" style={{ background: i <= step ? "#f97316" : "var(--surface-1)", color: i <= step ? "white" : "var(--text-secondary)" }}>{i < step ? <Check size={15} /> : i + 1}</span>{label}</li>)}
    </ol>
    <h2 className="text-xl font-bold">{step === 0 ? tri(lang, "با یک درس شروع کن", "Start with one course", "Starte mit einem Kurs", "Bir dersle başla") : step === 1 ? tri(lang, `جزوهٔ ${courseName} را اضافه کن`, `Add material for ${courseName}`, `Material für ${courseName} hinzufügen`, `${courseName} için kaynak ekle`) : tri(lang, "امروز چطور کمکت کنم؟", "How can I help you today?", "Wie kann ich dir heute helfen?", "Bugün sana nasıl yardımcı olayım?")}</h2>
    <p className="mt-2 mb-4 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{step === 0 ? tri(lang, "فقط نام درس را بنویس؛ بقیهٔ اطلاعات اختیاری است.", "Just enter the course name. Everything else is optional.", "Nur der Kursname ist nötig. Alles andere ist optional.", "Sadece ders adını yaz. Diğer bilgiler isteğe bağlı.") : step === 1 ? tri(lang, "فایل جزوه، عکس یا صدای کلاس را اضافه کن؛ یا متن را مستقیم بچسبان.", "Upload a document, photo or class recording, or paste your text.", "Dokument, Foto oder Aufnahme hochladen oder Text einfügen.", "Belge, fotoğraf veya ders kaydı yükle ya da metin yapıştır.") : tri(lang, `منابع ${courseName} آماده‌اند. یک هدف انتخاب کن؛ هر بار فقط یک کار انجام می‌دهیم.`, `Your ${courseName} materials are ready. Pick one goal to begin.`, `Deine Materialien für ${courseName} sind bereit. Wähle ein Ziel.`, `${courseName} kaynakların hazır. Başlamak için bir hedef seç.`)}</p>
    {step < 2 ? <button type="button" disabled={busy} onClick={step === 0 ? onCreate : onUpload} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">{step === 0 ? <BookOpen size={19}/> : <Upload size={19}/>}{step === 0 ? tri(lang, "ساخت اولین درس", "Create first course", "Ersten Kurs erstellen", "İlk dersi oluştur") : tri(lang, "افزودن جزوه یا ویس", "Add notes or audio", "Material oder Audio hinzufügen", "Not veya ses ekle")}</button> : <div className="grid gap-3 sm:grid-cols-3">{[
      { title: tri(lang, "می‌خواهم یاد بگیرم", "Help me learn", "Ich möchte lernen", "Öğrenmek istiyorum"), hint: tri(lang, "توضیح درس و پرسش‌وپاسخ", "Explain and discuss", "Erklären und besprechen", "Açıklama ve sorular"), icon: MessageCircle, action: onLearn },
      { title: tri(lang, "می‌خواهم مرور کنم", "Help me review", "Ich möchte wiederholen", "Tekrar etmek istiyorum"), hint: tri(lang, "فلش‌کارت · حداکثر ۵ اعتبار", "Flashcards · up to 5 credits", "Lernkarten · max. 5 Credits", "Kartlar · en fazla 5 kredi"), icon: Layers3, action: onReview },
      { title: tri(lang, "برای امتحان آماده شوم", "Prepare for an exam", "Für die Prüfung üben", "Sınava hazırlan"), hint: tri(lang, "آزمون تمرینی · حداکثر ۵ اعتبار", "Practice quiz · up to 5 credits", "Übungstest · max. 5 Credits", "Deneme · en fazla 5 kredi"), icon: Brain, action: onQuiz },
    ].map(({ title, hint, icon: Icon, action }) => <button key={title} type="button" disabled={busy} onClick={action} className="flex items-center gap-3 rounded-xl p-4 text-start disabled:opacity-50" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><Icon size={22} className="shrink-0 text-orange-500"/><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs" style={{ color: "var(--text-secondary)" }}>{hint}</span></span></button>)}</div>}
  </section>;
}
