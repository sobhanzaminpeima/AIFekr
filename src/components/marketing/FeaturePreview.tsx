"use client";
import { useState } from "react";
import { ArrowRight, Check, Play, RotateCcw, Sparkles } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import { copy, text, features, type Copy } from "@/lib/marketing/catalog";

const examples: Record<string, { input: Copy; output: Copy }> = {
  social: { input: ["کامنت نمونه: AIFekr", "Example comment: AIFekr", "Beispielkommentar: AIFekr", "Örnek yorum: AIFekr"], output: ["پیش‌نمایش دایرکت: ممنون! این لینک مربوط به همین پست است. هیچ پیامی ارسال نشد.", "DM preview: Thanks! Here is the link for this post. No message was sent.", "DM-Vorschau: Danke! Hier ist der Link zu diesem Beitrag. Keine Nachricht wurde versendet.", "DM önizlemesi: Teşekkürler! Bu gönderinin bağlantısı burada. Hiçbir mesaj gönderilmedi."] },
  crm: { input: ["مخاطب نمونه · نیازمند پیگیری", "Example contact · follow-up needed", "Beispielkontakt · Follow-up nötig", "Örnek kişi · takip gerekli"], output: ["نمونهٔ وظیفه: نیاز مشتری را بررسی و زمان گفتگو را هماهنگ کنید.", "Example task: Review the customer's needs and arrange a conversation.", "Beispielaufgabe: Kundenbedarf prüfen und Gespräch vereinbaren.", "Örnek görev: Müşterinin ihtiyacını inceleyin ve görüşme planlayın."] },
  education: { input: ["درس نمونه: آمار · امتحان هفتهٔ آینده", "Example course: Statistics · exam next week", "Beispielkurs: Statistik · Prüfung nächste Woche", "Örnek ders: İstatistik · gelecek hafta sınav"], output: ["نمونهٔ برنامه: مرور مفاهیم، حل تمرین و مرور اشتباهات؛ برنامهٔ واقعی از درس و امتحان شما ساخته می‌شود.", "Example plan: Review concepts, practise and revisit mistakes. Real plans use your courses and exams.", "Beispielplan: Konzepte wiederholen, üben, Fehler prüfen. Echte Pläne nutzen Ihre Kurse und Prüfungen.", "Örnek plan: Kavramları tekrarlayın, alıştırma yapın ve hataları inceleyin. Gerçek plan derslerinizi ve sınavlarınızı kullanır."] },
  accounting: { input: ["نمونهٔ هزینه · در انتظار بررسی", "Example expense · awaiting review", "Beispielausgabe · Prüfung ausstehend", "Örnek gider · inceleme bekliyor"], output: ["نمونهٔ مسیر: بررسی اطلاعات، انتخاب حساب و مشاهدهٔ گزارش. هیچ سندی ثبت نشده است.", "Example flow: Review details, select an account and view a report. No entry has been recorded.", "Beispielablauf: Daten prüfen, Konto auswählen, Bericht ansehen. Keine Buchung wurde erstellt.", "Örnek akış: Bilgileri inceleyin, hesap seçin, rapora bakın. Hiçbir kayıt oluşturulmadı."] },
  content: { input: ["موضوع نمونه: معرفی یک خدمت", "Example topic: introducing a service", "Beispielthema: einen Service vorstellen", "Örnek konu: hizmet tanıtımı"], output: ["پیش‌نمایش مسیر: پژوهش → پیش‌نویس → بررسی → سئو. انتشار نیازمند اتصال و تنظیمات واقعی است.", "Workflow preview: research → draft → review → SEO. Publishing requires real connections and settings.", "Ablaufvorschau: Recherche → Entwurf → Prüfung → SEO. Veröffentlichung benötigt echte Verbindungen und Einstellungen.", "Akış önizlemesi: araştırma → taslak → inceleme → SEO. Yayın için gerçek bağlantı ve ayarlar gerekir."] },
};
export default function FeaturePreview({ lang, slug }: { lang: Lang; slug: string }) {
  const [step, setStep] = useState(0);
  const f = features.find(f => f.slug === slug)!;
  const sample = examples[slug];
  return <div className="m-preview">
    <div className="m-demo-bar"><span className="m-live-dot"/><span>{text(lang, copy.demo)}</span></div>
    <div className="m-preview-body"><span className="m-eyebrow">{text(lang, f.title)}</span>
      <div className="m-preview-steps">{f.items.map((item, i) => <button key={item[1]} aria-pressed={step === i} onClick={() => setStep(i)}><span>{i < step ? <Check size={14}/> : `0${i + 1}`}</span>{text(lang, item)}</button>)}</div>
      <div className="m-preview-screen" aria-live="polite"><span className="m-preview-status"><Sparkles size={16}/>{text(lang, f.items[step])}</span><h3>{sample ? text(lang, sample.input) : text(lang, f.title)}</h3><p>{sample ? text(lang, sample.output) : text(lang, f.desc)}</p><span className="m-preview-skeleton"/><span className="m-preview-skeleton m-short"/></div>
      <div className="m-preview-controls"><button className="m-button m-small" onClick={() => setStep((step + 1) % f.items.length)}><Play size={14}/>{text(lang, ["مرحلهٔ بعد (نمایشی)", "Next step (demo)", "Nächster Schritt (Demo)", "Sonraki adım (demo)"])}<ArrowRight size={14}/></button><button className="m-button m-secondary m-small" aria-label={text(lang, ["شروع دوبارهٔ دمو", "Reset demo", "Demo zurücksetzen", "Demoyu sıfırla"])} onClick={() => setStep(0)}><RotateCcw size={14}/></button></div>
    </div>
  </div>;
}
