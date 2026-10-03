"use client";
import Link from "@/components/marketing/PublicLink";
import { useState } from "react";
import { Sparkles, ArrowUpRight, Check, MessageSquare, BookOpen, BriefcaseBusiness } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import { copy, features, text, type Copy } from "@/lib/marketing/catalog";

const journeys: { icon: typeof Sparkles; label: Copy; prompt: Copy; answer: Copy; modules: string[] }[] = [
  { icon: BriefcaseBusiness, label: ["کسب‌وکار", "Business", "Business", "İşletme"], prompt: ["برای پیگیری مشتریان از کجا شروع کنم؟", "Where do I start with customer follow-up?", "Wie beginne ich mit Kunden-Follow-ups?", "Müşteri takibine nereden başlamalıyım?"], answer: ["مخاطبان را در CRM مرتب کنید، وظایف پیگیری بسازید و پیشنهادهای AI را پیش از ارسال بررسی کنید.", "Organize your CRM contacts, create follow-up tasks and review AI suggestions before sending.", "CRM-Kontakte ordnen, Follow-up-Aufgaben erstellen und KI-Vorschläge vor dem Versand prüfen.", "CRM kişilerinizi düzenleyin, takip görevleri oluşturun ve göndermeden önce önerileri inceleyin."], modules: ["crm", "leads", "agents", "accounting"] },
  { icon: Sparkles, label: ["تولید محتوا", "Create", "Erstellen", "Üretim"], prompt: ["برای معرفی محصولم محتوا می‌خواهم.", "I need content for my product launch.", "Ich brauche Inhalte für meinen Produktstart.", "Ürün tanıtımım için içerik istiyorum."], answer: ["از پیش‌نویس شروع کنید، تصویر بسازید و محتوای تأییدشده را در ابزارهای مرتبط ادامه دهید.", "Start with a draft, create an image and take reviewed content into the relevant tools.", "Mit einem Entwurf starten, ein Bild erstellen und geprüfte Inhalte in den passenden Tools weiterbearbeiten.", "Taslakla başlayın, görsel oluşturun ve onayladığınız içeriği ilgili araçlarda ilerletin."], modules: ["assistant", "images", "content", "social"] },
  { icon: BookOpen, label: ["یادگیری", "Learn", "Lernen", "Öğrenme"], prompt: ["برای امتحان بعدی برنامه می‌خواهم.", "Help me plan for my next exam.", "Hilf mir beim Plan für die nächste Prüfung.", "Sonraki sınavım için plan yapmama yardım et."], answer: ["درس و امتحان را ثبت کنید، برنامهٔ مطالعه را بررسی کنید و زمان مطالعه را گزارش بگیرید.", "Add a course and exam, review a study plan and track your study sessions.", "Kurs und Prüfung hinzufügen, Lernplan prüfen und Lernzeiten dokumentieren.", "Ders ve sınav ekleyin, çalışma planını inceleyin ve çalışma oturumlarını takip edin."], modules: ["education", "assistant"] },
];
export default function Ecosystem({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const [active, setActive] = useState(0);
  const current = journeys[active];
  return <div className={`m-ecosystem ${compact ? "m-compact" : ""}`}>
    <div className="m-demo-bar"><span className="m-live-dot" aria-hidden="true"/><span>{text(lang, copy.demo)}</span><span className="m-demo-brand">AIFekr Workspace</span></div>
    <div className="m-demo-tabs" role="tablist" aria-label={text(lang, copy.solutions)}>{journeys.map((j, i) => <button key={i} role="tab" tabIndex={active === i ? 0 : -1} aria-selected={active === i} aria-controls="ecosystem-panel" id={`journey-${i}`} onClick={() => setActive(i)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3; setActive(next); document.getElementById(`journey-${next}`)?.focus(); } }}><j.icon size={16}/>{text(lang, j.label)}</button>)}</div>
    <div className="m-ecosystem-body" id="ecosystem-panel" role="tabpanel" aria-labelledby={`journey-${active}`}>
      <div className="m-ai-core"><div className="m-core-ring"/><Sparkles size={36}/><strong>AIFekr</strong><span>{text(lang, ["هستهٔ هوشمند", "AI workspace", "KI-Arbeitsbereich", "Yapay zekâ alanı"])}</span></div>
      <div className="m-connected"><span className="m-eyebrow">{text(lang, copy.product)}</span>{current.modules.map(slug => { const f = features.find(f => f.slug === slug)!; return <Link key={slug} href={`/features/${slug}`}><Check size={15}/>{text(lang, f.title)}<ArrowUpRight size={15}/></Link>; })}</div>
      <div className="m-chat-demo"><span><MessageSquare size={15}/> {text(lang, features.find(f => f.slug === "assistant")!.title)}</span><div className="m-demo-question">{text(lang, current.prompt)}</div><div className="m-demo-answer"><Sparkles size={18}/><p>{text(lang, current.answer)}</p></div><small>{text(lang, ["نمونهٔ مسیر؛ نتیجهٔ واقعی به ورودی شما بستگی دارد.", "Example workflow; real results depend on your input.", "Beispielablauf; echte Ergebnisse hängen von Ihren Eingaben ab.", "Örnek akış; gerçek sonuçlar girdilerinize bağlıdır."])}</small></div>
    </div>
  </div>;
}
