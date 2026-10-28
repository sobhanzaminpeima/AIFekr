"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import type { Copy2 } from "@/lib/growth/modules";
import "./smart-onboarding.css";

type Opt = { id: string; label: Copy2 };
export type OnboardingData = {
  enabled: boolean; credits: number; state: string; step: number;
  answers: { objective: string | null; persona: string | null; intent: string | null };
  options: { objectives: Opt[]; personas: Opt[]; intents: Opt[] };
  recommendation: { id: string; name: Copy2; path: string; firstValue: Copy2; exampleTask: Copy2 } | null;
};

/**
 * Four short steps (goal, who you are, why today, recommendation). Answers are
 * saved after each step so a user can leave and resume; skipping is always one
 * click and never loops back.
 */
export default function SmartOnboarding({ initial }: { initial: OnboardingData }) {
  const { lang } = useTranslation(), fa = lang === "fa", t = (a: string, b: string, c: string, d: string) => tri(lang, a, b, c, d);
  const label = (c: Copy2) => fa ? c[0] : c[1];
  const [data, setData] = useState(initial);
  const [step, setStep] = useState(Math.min(initial.step, 3));
  const [answers, setAnswers] = useState(initial.answers);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { document.title = "AIFekr"; }, []);

  async function send(action: "save" | "skip" | "complete", next?: number, override = answers) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/growth/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, step: next, ...override }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "FAILED");
      if (d.redirect) { window.location.assign(d.redirect); return; }
      if (next === 3) { const g = await fetch("/api/growth/onboarding", { cache: "no-store" }); if (g.ok) setData(await g.json()); }
      if (next !== undefined) setStep(next);
    } catch { setError(t("ذخیره نشد؛ دوباره تلاش کنید.", "Could not save. Please try again.", "Speichern fehlgeschlagen. Bitte erneut versuchen.", "Kaydedilemedi. Tekrar deneyin.")); }
    finally { setBusy(false); }
  }
  function choose(key: keyof typeof answers, id: string) {
    const next = { ...answers, [key]: id };
    setAnswers(next);
    void send("save", step + 1, next);
  }
  const questions: { key: keyof typeof answers; title: string; hint: string; options: Opt[]; optional?: boolean }[] = [
    { key: "objective", title: t("می‌خواهید با هوش مصنوعی چه کاری انجام دهید؟", "What would you like to accomplish with AI?", "Was möchten Sie mit KI erreichen?", "Yapay zekâ ile ne yapmak istiyorsunuz?"), hint: t("یکی را انتخاب کنید؛ بعداً همهٔ ابزارها در دسترس‌اند.", "Pick one — every tool stays available later.", "Wählen Sie eines – alle Werkzeuge bleiben verfügbar.", "Birini seçin — tüm araçlar sonra da açık."), options: data.options.objectives },
    { key: "persona", title: t("کدام شما را بهتر توصیف می‌کند؟", "Which best describes you?", "Was beschreibt Sie am besten?", "Sizi en iyi hangisi tanımlar?"), hint: t("اختیاری", "Optional", "Optional", "İsteğe bağlı"), options: data.options.personas, optional: true },
    { key: "intent", title: t("امروز برای چه به AIFekr آمده‌اید؟", "What brings you to AIFekr today?", "Was führt Sie heute zu AIFekr?", "Bugün sizi AIFekr'e ne getirdi?"), hint: t("اختیاری", "Optional", "Optional", "İsteğe bağlı"), options: data.options.intents, optional: true },
  ];
  const q = questions[step];
  const rec = data.recommendation;
  const Back = fa ? ArrowRight : ArrowLeft, Next = fa ? ArrowLeft : ArrowRight;
  return <main className="so-shell" dir={fa ? "rtl" : "ltr"}>
    <div className="so-card">
      <header className="so-head"><span className="so-brand"><Sparkles size={18}/>AIFekr</span><button className="so-link" disabled={busy} onClick={() => void send("skip")}>{t("رد کردن", "Skip", "Überspringen", "Geç")}</button></header>
      <ol className="so-progress" aria-label={t("مراحل", "Steps", "Schritte", "Adımlar")}>{[0, 1, 2, 3].map(i => <li key={i} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}>{i < step ? <Check size={12}/> : i + 1}</li>)}</ol>
      {q ? <section aria-live="polite">
        <h1>{q.title}</h1><p className="so-hint">{q.hint}</p>
        <div className="so-options">{q.options.map(o => <button key={o.id} aria-pressed={answers[q.key] === o.id} disabled={busy} onClick={() => choose(q.key, o.id)}>{label(o.label)}</button>)}</div>
        <footer className="so-foot">{step > 0 ? <button className="so-link" disabled={busy} onClick={() => setStep(step - 1)}><Back size={16}/>{t("قبلی", "Back", "Zurück", "Geri")}</button> : <span/>}{q.optional && <button className="so-link" disabled={busy} onClick={() => void send("save", step + 1)}>{t("بعدی بدون پاسخ", "Next without answering", "Weiter ohne Antwort", "Cevapsız devam")}<Next size={16}/></button>}</footer>
      </section> : <section aria-live="polite">
        <h1>{t("پیشنهاد ما برای شروع", "Our suggestion to start", "Unser Vorschlag zum Start", "Başlangıç önerimiz")}</h1>
        {rec ? <div className="so-rec">
          <strong>{label(rec.name)}</strong>
          <p><span>{t("اولین قدم", "First task", "Erste Aufgabe", "İlk görev")}:</span> {label(rec.exampleTask)}</p>
          <p><span>{t("نتیجهٔ مورد انتظار", "What you'll get", "Ergebnis", "Sonuç")}:</span> {label(rec.firstValue)}</p>
          <p><span>{t("اعتبار شما", "Your credits", "Ihre Credits", "Krediniz")}:</span> {data.credits.toLocaleString(lang)} — {t("هزینهٔ هر کار پیش از اجرا در خود ابزار نمایش داده می‌شود.", "each tool shows the cost before it runs.", "jedes Werkzeug zeigt die Kosten vor dem Start.", "her araç maliyeti çalışmadan önce gösterir.")}</p>
        </div> : <p className="so-hint">{t("هر ابزاری را از صفحهٔ اصلی انتخاب کنید.", "Pick any tool from the home page.", "Wählen Sie ein Werkzeug auf der Startseite.", "Ana sayfadan bir araç seçin.")}</p>}
        <button className="so-primary" disabled={busy} onClick={() => void send("complete")}>{busy ? <Loader2 size={18} className="so-spin"/> : null}{rec ? t("شروع کنیم", "Let's start", "Los geht's", "Başlayalım") : t("ورود به AIFekr", "Go to AIFekr", "Zu AIFekr", "AIFekr'e git")}</button>
        <footer className="so-foot"><button className="so-link" disabled={busy} onClick={() => setStep(2)}><Back size={16}/>{t("قبلی", "Back", "Zurück", "Geri")}</button></footer>
      </section>}
      {error && <p className="so-error" role="alert">{error}</p>}
    </div>
  </main>;
}
