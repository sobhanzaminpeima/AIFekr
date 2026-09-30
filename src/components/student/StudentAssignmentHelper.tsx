"use client";

import { useState } from "react";
import { Clipboard, Loader2, Sparkles } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Mode = "understand" | "steps" | "outline" | "feedback" | "hint";

export default function StudentAssignmentHelper({ courseId, lang }: { courseId: string; lang: Lang }) {
  const [mode, setMode] = useState<Mode>("understand");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true); setError(""); setAnswer(""); setCredits(null);
    try {
      const response = await fetch("/api/student/assignment-assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, mode, prompt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "درخواست ناموفق بود");
      setAnswer(body.answer); setCredits(body.creditsUsed);
    } catch (e) { setError(e instanceof Error ? e.message : "درخواست ناموفق بود"); }
    finally { setBusy(false); }
  }

  const modeOptions: { id: Mode; label: string }[] = [
    { id: "understand", label: tri(lang, "فهم صورت‌مسئله", "Understand the brief", "Aufgabe verstehen", "Görevi anla") },
    { id: "steps", label: tri(lang, "تقسیم به گام‌ها", "Break into steps", "In Schritte teilen", "Adımlara böl") },
    { id: "outline", label: tri(lang, "ساختار اولیه", "Build an outline", "Gliederung erstellen", "Taslak oluştur") },
    { id: "feedback", label: tri(lang, "بازخورد روی پیش‌نویس", "Review my draft", "Entwurf prüfen", "Taslağımı değerlendir") },
    { id: "hint", label: tri(lang, "راهنمای سقراطی", "Socratic hint", "Sokratischer Hinweis", "Sokratik ipucu") },
  ];

  const fieldStyle: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)" };
  return (
    <section className="mt-5 rounded-xl p-4 md:p-5" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
      <h3 className="font-semibold flex items-center gap-2"><Sparkles size={17} color="#8b5cf6" />{tri(lang, "راهنمای تکلیف با تمرکز بر یادگیری", "Learning-focused assignment helper", "Lernorientierte Aufgabenhilfe", "Öğrenme odaklı ödev yardımcısı")}</h3>
      <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-secondary)" }}>{tri(lang, "صورت‌مسئله، rubric یا پیش‌نویس خودت را وارد کن. دستیار کمک می‌کند یاد بگیری؛ تکلیف ارزیابی‌شده را به‌جایت نمی‌نویسد.", "Paste your brief, rubric, or draft. The tutor helps you learn; it will not write assessed work for you.", "Füge Aufgabe, Bewertungsraster oder Entwurf ein. Die Hilfe unterstützt das Lernen, schreibt aber keine Prüfungsleistung für dich.", "Görev metnini, rubriği veya taslağını ekle. Asistan öğrenmene yardım eder; değerlendirilen çalışmayı senin yerine yazmaz.")}</p>
      <form onSubmit={run} className="space-y-2">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="w-full rounded-lg px-3 py-2 text-sm" style={fieldStyle}>
          {modeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={8000} required rows={4} placeholder={tri(lang, "متن تکلیف، معیارهای استاد یا بخش کوتاهی از پیش‌نویس…", "Assignment prompt, rubric, or a short draft excerpt…", "Aufgabenstellung, Bewertungsraster oder kurzer Entwurf…", "Ödev, değerlendirme ölçütü veya kısa taslak bölümü…")} className="w-full rounded-lg p-3 text-sm" style={fieldStyle} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "حداقل ۵ اعتبار لازم است؛ هزینهٔ واقعی پس از پاسخ موفق ثبت می‌شود.", "At least 5 credits are required; actual provider usage is charged after a successful answer.", "Mindestens 5 Credits; der tatsächliche Verbrauch wird nach erfolgreicher Antwort berechnet.", "En az 5 kredi gerekir; gerçek kullanım başarılı yanıt sonrası düşülür.")}</span>
          <button disabled={busy || !prompt.trim()} className="rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#8b5cf6" }}>
            {busy ? <><Loader2 size={15} className="inline me-1 animate-spin" />{tri(lang, "در حال بررسی…", "Working…", "Wird geprüft…", "İşleniyor…")}</> : tri(lang, "راهنمایی کن", "Help me learn", "Lernhilfe", "Yardım et")}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm" style={{ color: "#dc2626" }}>{error}</p>}
      {answer && <div className="mt-4 rounded-lg p-4" style={{ background: "var(--surface-1)" }}>
        <div className="flex justify-between items-center gap-2 text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          <span>{tri(lang, `راهنمایی · ${credits} اعتبار`, `Tutor response · ${credits} credits`, `Lernhilfe · ${credits} Credits`, `Öğretmen yanıtı · ${credits} kredi`)}</span>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(answer).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ color: "var(--primary)" }}>
            <Clipboard size={13} />{copied ? tri(lang, "کپی شد", "Copied", "Kopiert", "Kopyalandı") : tri(lang, "کپی", "Copy", "Kopieren", "Kopyala")}
          </button>
        </div>
        <div className="text-sm leading-7 whitespace-pre-wrap">{answer}</div>
      </div>}
    </section>
  );
}
