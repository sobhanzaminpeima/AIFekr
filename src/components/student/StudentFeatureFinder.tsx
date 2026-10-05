"use client";

import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

export type StudentDestination = "courses" | "planner" | "groups" | "reports" | "thesis" | "profile" | "business" | "upload" | "notes" | "practice" | "review" | "assignment";

export default function StudentFeatureFinder({ lang, onSelect }: { lang: Lang; onSelect: (destination: StudentDestination) => void }) {
  const [query, setQuery] = useState("");
  const entries: { id: StudentDestination; label: string; description: string }[] = [
    { id: "courses", label: tri(lang, "درس و گفتگوی درسی", "Courses & study chat", "Kurse und Lernchat", "Ders ve çalışma sohbeti"), description: tri(lang, "درس‌ها، سؤال از جزوه و توضیح مفاهیم", "Courses, source questions and explanations", "Kurse, Quellenfragen und Erklärungen", "Dersler, kaynak soruları ve açıklamalar") },
    { id: "upload", label: tri(lang, "آپلود جزوه، عکس و ویس", "Upload notes, photos or audio", "Material, Fotos oder Audio hochladen", "Not, fotoğraf ve ses yükle"), description: tri(lang, "PDF، Word، اسلاید یا صدای کلاس", "PDF, Word, slides or class recordings", "PDF, Word, Folien oder Aufnahmen", "PDF, Word, slayt veya ders kaydı") },
    { id: "review", label: tri(lang, "مرور و فلش‌کارت", "Review & flashcards", "Wiederholen und Lernkarten", "Tekrar ve kartlar"), description: tri(lang, "ساخت کارت و مرور مرحله‌به‌مرحله", "Create cards and review step by step", "Karten erstellen und schrittweise wiederholen", "Kart oluştur ve adım adım tekrar et") },
    { id: "practice", label: tri(lang, "آزمون تمرینی", "Practice quiz", "Übungstest", "Deneme sınavı"), description: tri(lang, "خودت را بسنج و نقاط ضعف را پیدا کن", "Check your understanding and weak topics", "Verständnis und Schwächen prüfen", "Bilgini ve eksik konuları kontrol et") },
    { id: "planner", label: tri(lang, "امتحان، برنامه و تکلیف‌ها", "Exams, planner & tasks", "Prüfungen, Plan und Aufgaben", "Sınav, plan ve görevler"), description: tri(lang, "ثبت تاریخ امتحان و ساخت برنامهٔ مطالعه", "Set exam dates and build a study plan", "Prüfungstermine und Lernplan", "Sınav tarihi ve çalışma planı") },
    { id: "notes", label: tri(lang, "یادداشت‌ها و پاسخ‌های ذخیره‌شده", "Notes & saved answers", "Notizen und gespeicherte Antworten", "Notlar ve kayıtlı yanıtlar"), description: tri(lang, "خواندن پاسخ‌ها یا نوشتن یادداشت جدید", "Read saved answers or write a note", "Antworten lesen oder Notiz schreiben", "Yanıtları oku veya not yaz") },
    { id: "assignment", label: tri(lang, "کمک به تکلیف درسی", "Course assignment help", "Hilfe bei Kursaufgaben", "Ders ödevi yardımı"), description: tri(lang, "فهم صورت سؤال، راهنمای مرحله‌ای و بازبینی", "Understand, work step by step and review", "Verstehen, schrittweise bearbeiten und prüfen", "Anla, adım adım çalış ve gözden geçir") },
    { id: "thesis", label: tri(lang, "پایان‌نامه و پژوهش", "Thesis & research", "Abschlussarbeit und Forschung", "Tez ve araştırma"), description: tri(lang, "پروپوزال، ساختار و بازبینی پژوهش", "Proposal, structure and research review", "Exposé, Gliederung und Überprüfung", "Öneri, yapı ve araştırma incelemesi") },
    { id: "groups", label: tri(lang, "گروه مطالعه و دعوت همکلاسی", "Study groups & classmates", "Lerngruppen und Kommilitonen", "Çalışma grubu ve sınıf arkadaşları"), description: tri(lang, "مطالعهٔ مشترک و گفتگوی گروهی", "Shared study and group chat", "Gemeinsam lernen und chatten", "Birlikte çalışma ve grup sohbeti") },
    { id: "reports", label: tri(lang, "زمان‌سنج و گزارش مطالعه", "Timer & study reports", "Timer und Lernberichte", "Sayaç ve çalışma raporu"), description: tri(lang, "ثبت زمان مطالعه و دیدن پیشرفت", "Track study time and progress", "Lernzeit und Fortschritt erfassen", "Çalışma süresi ve ilerleme") },
    { id: "profile", label: tri(lang, "کارت و پروفایل دانشجویی", "Student card & profile", "Studierendenkarte und Profil", "Öğrenci kartı ve profil"), description: tri(lang, "عکس، اطلاعات و اشتراک‌گذاری کارت", "Photo, details and card sharing", "Foto, Angaben und Karte teilen", "Fotoğraf, bilgiler ve kart paylaşımı") },
    { id: "business", label: tri(lang, "ابزارهای کسب‌وکار", "Business tools", "Geschäftswerkzeuge", "İşletme araçları"), description: tri(lang, "بررسی دسترسی بیزنس و CRM", "Check business and CRM access", "Geschäfts- und CRM-Zugang prüfen", "İşletme ve CRM erişimini kontrol et") },
  ];
  const normalized = query.trim().toLocaleLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک");
  const matches = entries.filter(item => `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalized));
  return <div className="student-feature-finder">
    <label className="mb-4 flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: "var(--border)" }}><Search size={18}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} aria-label={tri(lang, "پیدا کردن امکانات", "Find features", "Funktionen finden", "Özellik bul")} placeholder={tri(lang, "مثلاً ویس، امتحان، کارت…", "Try audio, exam, card…", "Zum Beispiel Audio, Prüfung, Karte…", "Ses, sınav, kart…")} className="min-w-0 w-full bg-transparent py-3 text-sm"/></label>
    <div className="grid gap-2">{matches.map(item => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="flex min-h-14 items-center gap-3 rounded-xl border p-3 text-start" style={{ borderColor: "var(--border)" }}><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{item.description}</span></span><ArrowRight size={16} className={lang === "fa" ? "rotate-180" : ""}/></button>)}</div>
    {!matches.length && <p role="status" className="py-5 text-sm">{tri(lang, "چیزی پیدا نشد؛ عبارت کوتاه‌تری بنویس.", "No matches. Try a shorter search.", "Keine Treffer. Versuche einen kürzeren Suchbegriff.", "Sonuç yok. Daha kısa bir arama dene.")}</p>}
  </div>;
}
