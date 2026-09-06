import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { TrendingUp, Users, BarChart3, Globe, Zap, ArrowLeft, ArrowRight } from "lucide-react";
import ContinueWithoutPackButton from "./ContinueWithoutPackButton";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export default async function BusinessGate({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { industryPackId: true },
      });
      if (user?.industryPackId) return <>{children}</>;
    }
  }

  // Honors the "continue without a package" choice below — once set, the
  // user gets straight through to the tool they came for on every visit,
  // instead of hitting this pitch screen again on the very next page load.
  if (cookieStore.get("skipBusinessGate")?.value === "1") return <>{children}</>;

  // This is the screen a user without an industry pack lands on before any
  // business tool -- it was Persian-only with an RTL-only arrow, so it was a
  // dead end for an English or German account.
  const lang = await getServerLang();
  const rtl = lang === "fa";

  const features = [
    { icon: BarChart3, label: tri(lang, "دکتر کسب‌وکار", "Business Doctor", "Business Doctor"), desc: tri(lang, "تحلیل و مشاوره هوشمند", "Smart analysis and advice", "Intelligente Analyse und Beratung") },
    { icon: Users, label: tri(lang, "اتاق جلسه AI", "AI Meeting Room", "KI-Meetingraum"), desc: tri(lang, "جلسه با ایجنت‌های متخصص", "Meet with specialist agents", "Besprechung mit Fachagenten") },
    { icon: Globe, label: tri(lang, "سئو حرفه‌ای", "Professional SEO", "Professionelles SEO"), desc: tri(lang, "رتبه‌بندی و بهینه‌سازی", "Ranking and optimisation", "Ranking und Optimierung") },
    { icon: Zap, label: tri(lang, "شبکه‌های اجتماعی", "Social media", "Social Media"), desc: tri(lang, "تولید محتوا خودکار", "Automatic content generation", "Automatische Content-Erstellung") },
    { icon: TrendingUp, label: tri(lang, "مشاور مدیرعامل", "CEO Advisor", "CEO-Berater"), desc: tri(lang, "استراتژی و تصمیم‌گیری", "Strategy and decisions", "Strategie und Entscheidungen") },
    { icon: Globe, label: tri(lang, "طراح وبسایت", "Website Designer", "Website-Designer"), desc: tri(lang, "ساخت سایت هوشمند", "Build a smart site", "Intelligente Website erstellen") },
  ];
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir={rtl ? "rtl" : "ltr"} style={{ background: "var(--surface-0)" }}>
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
          <TrendingUp className="w-10 h-10 text-white" />
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "آیا می‌خواهی کسب‌وکارت رشد کنه؟", "Ready to grow your business?", "Bereit, Ihr Unternehmen wachsen zu lassen?")}
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {tri(lang,
              "با ایجنت‌های هوش مصنوعی تخصصی، کسب‌وکار خود را به سطح بعدی ببر.",
              "Take your business to the next level with specialist AI agents.",
              "Bringen Sie Ihr Unternehmen mit spezialisierten KI-Agenten auf die nächste Stufe.")}<br />
            {tri(lang,
              "تحلیل، استراتژی، سئو، شبکه‌های اجتماعی و جلسات هوشمند — همه در یک پلتفرم.",
              "Analysis, strategy, SEO, social media and smart meetings — all on one platform.",
              "Analyse, Strategie, SEO, Social Media und intelligente Meetings — alles auf einer Plattform.")}
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className={`p-4 rounded-2xl ${rtl ? "text-right" : "text-left"}`}
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <Icon className="w-5 h-5 mb-2" style={{ color: "#ea580c" }} />
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/industry"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
            {tri(lang, "مشاهده بسته‌های صنعتی", "Browse industry packs", "Branchenpakete ansehen")}
            <Arrow className="w-5 h-5" />
          </Link>
          <ContinueWithoutPackButton />
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {tri(lang,
            "بسته‌های صنعتی برای کسب‌وکارها طراحی شده‌اند و شامل ایجنت‌های تخصصی هر صنعت می‌باشند.",
            "Industry packs are built for businesses and include agents specialised in each industry.",
            "Branchenpakete sind für Unternehmen gemacht und enthalten Agenten, die auf die jeweilige Branche spezialisiert sind.")}
        </p>
      </div>
    </div>
  );
}