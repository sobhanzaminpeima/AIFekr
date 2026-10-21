import StudentActivationLink from "@/components/student/StudentActivationLink";
import { ArrowLeft, ArrowRight, BookOpen, Brain, CalendarDays, FileText, GraduationCap, Layers3, Sparkles } from "lucide-react";
import { tri } from "@/lib/i18n/tri";

export default function StudentWorkspaceTeaser({ lang }: { lang: "fa" | "en" | "de" | "tr" }) {
  const rtl = lang === "fa";
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const features = [
    { icon: BookOpen, label: tri(lang, "فضای اختصاصی هر درس", "A workspace for every course", "Ein Lernraum pro Kurs", "Her ders için ayrı alan") },
    { icon: FileText, label: tri(lang, "جزوه PDF و Word", "PDF and Word materials", "PDF- und Word-Unterlagen", "PDF ve Word kaynakları") },
    { icon: Brain, label: tri(lang, "معلم AI متکی به منبع", "Source-grounded AI tutor", "Quellenbasierter KI-Tutor", "Kaynak temelli AI öğretmeni") },
    { icon: Layers3, label: tri(lang, "فلش‌کارت و آزمون", "Flashcards and quizzes", "Lernkarten und Tests", "Kartlar ve sınavlar") },
    { icon: CalendarDays, label: tri(lang, "تقویم امتحان", "Exam calendar", "Prüfungskalender", "Sınav takvimi") },
  ];
  return <section className="px-6 py-16 md:py-20" id="student-workspace" dir={rtl ? "rtl" : "ltr"}>
    <div className="max-w-6xl mx-auto rounded-[28px] overflow-hidden" style={{ background: "linear-gradient(125deg,rgba(249,115,22,.16),rgba(59,130,246,.1) 55%,rgba(139,92,246,.12))", border: "1px solid rgba(249,115,22,.28)" }}>
      <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-8 p-7 md:p-11 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-5" style={{ background: "rgba(249,115,22,.14)", color: "#fb923c" }}><GraduationCap size={15}/>{tri(lang, "برای دانشجوها و یادگیرنده‌ها", "For students and lifelong learners", "Für Studierende und Lernende", "Öğrenciler ve öğrenenler için")}</div>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">{tri(lang, "یک دانشگاه هوش مصنوعی برای درس‌های خودت", "Your AI university for every course", "Deine KI-Universität für jeden Kurs", "Her ders için yapay zekâ üniversiten")}</h2>
          <p className="mt-4 leading-7 max-w-xl" style={{ color: "rgba(255,255,255,.68)" }}>{tri(lang, "جزوه‌ها را وارد کن، از همان منبع سؤال بپرس، فلش‌کارت و آزمون بساز و امتحان‌ها را منظم نگه دار. فضای دانشجویی جدا از ابزارهای بیزنسی است.", "Bring your notes, ask questions grounded in your own materials, generate flashcards and quizzes, and keep exams organized—without a business dashboard in the way.", "Lade deine Unterlagen hoch, frage auf Basis deiner Quellen, erstelle Lernkarten und Tests und behalte Prüfungen im Blick – getrennt von Business-Tools.", "Notlarını yükle, kendi kaynaklarına dayalı sorular sor, kartlar ve testler oluştur, sınavlarını düzenle; işletme araçları araya girmez.")}</p>
          <StudentActivationLink className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white" style={{ background: "#ea580c" }}>{tri(lang, "شروع فضای دانشجویی", "Explore the Student Workspace", "Lernbereich entdecken", "Öğrenci alanını keşfet")}<Arrow size={17}/></StudentActivationLink>
          <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{tri(lang, "مصرف AI از اعتبار حساب محاسبه می‌شود؛ بدون ادعای امکانات رایگان نامحدود.", "AI actions use your account credits; no unlimited-free claim.", "KI-Aktionen verbrauchen Kontoguthaben; kein unbegrenztes Gratisversprechen.", "AI işlemleri hesabındaki kredileri kullanır; sınırsız ücretsiz kullanım iddiası yoktur.")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">{features.map(({ icon: Icon, label }, index) => <div key={label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(8,10,16,.52)", border: "1px solid rgba(255,255,255,.08)", gridColumn: index === 4 ? "1 / -1" : undefined }}><span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "rgba(249,115,22,.13)", color: "#fb923c" }}><Icon size={19}/></span><span className="text-sm font-medium">{label}</span><Sparkles size={13} className="ms-auto opacity-40"/></div>)}</div>
      </div>
    </div>
  </section>;
}
