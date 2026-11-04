"use client";
// Classic theme copy of the new design's components/feature-announcement.tsx.
// One-time announcement of a new feature inside the signed-in frame (today:
// AIFekr Live). Closed for good with the × or "Later"; "Try it" opens the
// feature. Remembered per browser; never shown on the feature's own page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AudioLines, Gift, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import "./live-talk.css";

const KEY = "aifekr-announce-live-v1";
const COPY = {
  badge: ["قابلیت جدید", "New", "Neu", "Yeni"],
  title: ["با هوش مصنوعی حرف بزنید: AIFekr Live", "Talk with AI: AIFekr Live", "Mit der KI sprechen: AIFekr Live", "Yapay zekâyla konuşun: AIFekr Live"],
  body: [
    "حالا می‌توانید با صدای خودتان درباره هر موضوعی با فیکا یا فیکو گفتگو کنید؛ بی‌مکث جواب می‌دهد، وسط حرفش می‌توانید صحبت کنید و گفتگوها ذخیره می‌شوند تا بعداً ادامه دهید.",
    "Now you can talk about anything with Fika or Fiko, out loud. It answers instantly, you can talk over it, and conversations are saved so you can pick them up later.",
    "Sprechen Sie mit Fika oder Fiko über jedes Thema. Sofortige Antworten, Sie können jederzeit unterbrechen, und Gespräche werden gespeichert.",
    "Fika veya Fiko ile her konuda sesli konuşun. Anında yanıt verir, sözünü kesebilirsiniz ve konuşmalar kaydedilir.",
  ],
  free: ["دقیقهٔ اول رایگان است.", "Your first minute is free.", "Die erste Minute ist kostenlos.", "İlk dakika ücretsiz."],
  go: ["شروع گفتگوی صوتی", "Start a voice conversation", "Sprachgespräch starten", "Sesli konuşmayı başlat"],
  later: ["بعداً", "Later", "Später", "Sonra"],
  close: ["بستن", "Close", "Schließen", "Kapat"],
} as const;
const LOCALES = ["fa", "en", "de", "tr"] as const;

export default function FeatureAnnouncement({ path }: { path: string }) {
  const { lang: locale } = useTranslation();
  const say = (k: keyof typeof COPY) => COPY[k][Math.max(0, LOCALES.indexOf(locale as (typeof LOCALES)[number]))];
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (path === "/live") return;
    let seen = "1";
    try { seen = localStorage.getItem(KEY) || ""; } catch { /* private mode: never nag */ }
    if (seen) return;
    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
  }
  if (!open) return null;
  return (
    <div className="feature-announce-backdrop" onClick={dismiss}>
      <div className="feature-announce" role="dialog" aria-modal="true" aria-labelledby="feature-announce-title" onClick={(e) => e.stopPropagation()} dir={locale === "fa" ? "rtl" : "ltr"}>
        <button className="feature-announce-close" onClick={dismiss} aria-label={say("close")}><X size={18} /></button>
        <div className="feature-announce-art" aria-hidden="true">
          <span className="feature-announce-orb" />
          <span className="feature-announce-wave"><i /><i /><i /><i /><i /></span>
        </div>
        <span className="feature-announce-badge"><Sparkles size={13} /> {say("badge")}</span>
        <h2 id="feature-announce-title">{say("title")}</h2>
        <p>{say("body")}</p>
        <p className="feature-announce-free"><Gift size={15} /> {say("free")}</p>
        <div className="feature-announce-actions">
          <Link href="/live" className="btn primary" onClick={dismiss}><AudioLines size={17} /> {say("go")}</Link>
          <button className="btn" onClick={dismiss}>{say("later")}</button>
        </div>
      </div>
    </div>
  );
}
