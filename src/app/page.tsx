import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import CurrencySelector from "@/components/ui/CurrencySelector";
import DemoChat from "@/components/landing/DemoChat";
import Image from "next/image";

export const dynamic = "force-dynamic";

const STR = {
  fa: {
    brand: "هوشمند AI",
    navPacks: "بسته‌های صنعتی",
    navLogin: "ورود",
    navRegister: "شروع رایگان",
    badge: "پلتفرم هوش مصنوعی کسب‌وکار",
    heroTitle1: "تیم هوش مصنوعی",
    heroTitle2: "مخصوص کسب‌وکار شما",
    heroDesc: "بسته‌های هوش مصنوعی ویژه برای هر صنعت — از ساختمان تا کلینیک، از رستوران تا هتل. عوامل AI شما ۲۴/۷ کار می‌کنند.",
    ctaStart: "شروع رایگان →",
    ctaViewPacks: "مشاهده بسته‌ها",
    howTitle: "چطور کار می‌کند؟",
    howSubtitle: "در ۳ مرحله ساده",
    steps: [
      { step: "۱", icon: "🏭", title: "صنعت خود را انتخاب کنید", desc: "از ۸ بسته صنعتی آماده، بسته مناسب کسب‌وکار خود را انتخاب کنید" },
      { step: "۲", icon: "👤", title: "ثبت‌نام کنید", desc: "در ۳۰ ثانیه حساب کاربری بسازید و بسته انتخابی را فعال کنید" },
      { step: "۳", icon: "🤖", title: "عوامل AI را به کار بگیرید", desc: "عوامل هوش مصنوعی مخصوص کسب‌وکار شما ۲۴/۷ شروع به کار می‌کنند" },
    ],
    stepLabel: "مرحله",
    packsTitle: "بسته‌های صنعتی",
    packsSubtitle: "هر بسته شامل تیمی از عوامل AI متخصص صنعت شماست",
    agentsLabel: "عامل AI",
    viewPack: "مشاهده بسته →",
    viewAllPacks: "مشاهده همه بسته‌ها",
    featuresTitle: "ابزارهای هوش مصنوعی",
    features: [
      { icon: "🩺", title: "دکتر کسب‌وکار", desc: "تحلیل SWOT، برنامه اقدام ۹۰ روزه، شناسایی نقاط ضعف", href: "/business-doctor" },
      { icon: "👑", title: "مشاور مدیرعامل", desc: "مشاور استراتژیک با ۲۰+ سال تجربه برای تصمیمات اجرایی", href: "/ceo" },
      { icon: "🔍", title: "فضای کار سئو", desc: "تحقیق کلمات کلیدی، آنالیز URL، بهینه‌سازی محتوا", href: "/seo" },
      { icon: "📱", title: "عامل شبکه اجتماعی", desc: "تولید محتوا برای اینستاگرام، لینکدین، توییتر و تیک‌تاک", href: "/social" },
      { icon: "🌐", title: "طراح وبسایت AI", desc: "طراحی و کدنویسی وبسایت حرفه‌ای کامل با یک کلیک", href: "/website-designer" },
      { icon: "🤝", title: "اتاق جلسه AI", desc: "شبیه‌سازی جلسه استراتژیک با ۷ عامل متخصص", href: "/meeting" },
    ],
    ctaTitle: "آماده شروع هستید؟",
    ctaDesc: "همین الان بسته صنعتی خود را انتخاب کنید و عوامل AI را به کار بگیرید",
    ctaButton: "شروع رایگان — همین الان",
    footer: "© ۲۰۲۵ هوشمند AI — پلتفرم هوش مصنوعی کسب‌وکار",
  },
  en: {
    brand: "Hooshmand AI",
    navPacks: "Industry Packs",
    navLogin: "Login",
    navRegister: "Get Started Free",
    badge: "AI Platform for Business",
    heroTitle1: "An AI Team",
    heroTitle2: "Built for Your Business",
    heroDesc: "Dedicated AI agent packs for every industry — from construction to clinics, restaurants to hotels. Your AI agents work 24/7.",
    ctaStart: "Get Started Free →",
    ctaViewPacks: "View Packs",
    howTitle: "How It Works",
    howSubtitle: "In 3 simple steps",
    steps: [
      { step: "1", icon: "🏭", title: "Choose Your Industry", desc: "Pick the right pack for your business from 8 ready-made industry packs" },
      { step: "2", icon: "👤", title: "Sign Up", desc: "Create an account in 30 seconds and activate your chosen pack" },
      { step: "3", icon: "🤖", title: "Deploy AI Agents", desc: "AI agents tailored to your business start working 24/7" },
    ],
    stepLabel: "Step",
    packsTitle: "Industry Packs",
    packsSubtitle: "Each pack includes a team of AI agents specialized for your industry",
    agentsLabel: "AI agents",
    viewPack: "View Pack →",
    viewAllPacks: "View All Packs",
    featuresTitle: "AI Tools",
    features: [
      { icon: "🩺", title: "Business Doctor", desc: "SWOT analysis, 90-day action plan, weakness detection", href: "/business-doctor" },
      { icon: "👑", title: "CEO Advisor", desc: "Strategic advisor with 20+ years of experience for executive decisions", href: "/ceo" },
      { icon: "🔍", title: "SEO Workspace", desc: "Keyword research, URL analysis, content optimization", href: "/seo" },
      { icon: "📱", title: "Social Media Agent", desc: "Content generation for Instagram, LinkedIn, Twitter and TikTok", href: "/social" },
      { icon: "🌐", title: "AI Website Designer", desc: "Design and code a complete professional website with one click", href: "/website-designer" },
      { icon: "🤝", title: "AI Meeting Room", desc: "Simulate a strategic meeting with 7 specialist agents", href: "/meeting" },
    ],
    ctaTitle: "Ready to Get Started?",
    ctaDesc: "Choose your industry pack now and deploy your AI agents",
    ctaButton: "Get Started Free — Now",
    footer: "© 2025 Hooshmand AI — AI Platform for Business",
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const { redirect } = await import("next/navigation");
      redirect("/chat");
    }
  }

  const lang = await getServerLang();
  const s = STR[lang];
  const dir = lang === "fa" ? "rtl" : "ltr";

  let packs: { id: string; slug: string; name: string; emoji: string; tagline: string; agents: string; tier: string; price: number; color: string; gradientFrom: string; gradientTo: string }[] = [];
  try {
    packs = await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 8 });
  } catch {}

  return (
    <div className="min-h-screen" dir={dir} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4" style={{ background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg text-white">AiFekr</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/industry" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{s.navPacks}</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{s.navLogin}</Link>
          <Link href="/register" className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all" style={{ background: "#ea580c" }}>{s.navRegister}</Link>
          <CurrencySelector />
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #ea580c, transparent)" }} />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6" style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)", color: "#ea580c" }}>
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {s.badge}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            {s.heroTitle1}{" "}
            <span style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {s.heroTitle2}
            </span>
          </h1>
          <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
            {s.heroDesc}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register" className="px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
              {s.ctaStart}
            </Link>
            <Link href="/industry" className="px-8 py-4 rounded-2xl font-semibold text-lg transition-all" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
              {s.ctaViewPacks}
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Chat */}
      <DemoChat lang={lang} />

      {/* How it works */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{s.howTitle}</h2>
          <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.howSubtitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {s.steps.map((item) => (
              <div key={item.step} className="text-center p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl" style={{ background: "rgba(234,88,12,0.15)" }}>
                  {item.icon}
                </div>
                <div className="text-xs font-bold mb-2" style={{ color: "#ea580c" }}>{s.stepLabel} {item.step}</div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Packs */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{s.packsTitle}</h2>
          <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.packsSubtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {packs.map((pack) => {
              let agentCount = 0;
              try { agentCount = JSON.parse(pack.agents).length; } catch {}
              return (
                <Link key={pack.id} href={`/industry/${pack.slug}`} className="group block rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="p-5" style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}aa, ${pack.gradientTo}aa)` }}>
                    <span className="text-3xl">{pack.emoji}</span>
                    <h3 className="font-bold mt-2 text-white">{pack.name}</h3>
                    <p className="text-xs mt-1 text-white/70">{pack.tagline}</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{agentCount} {s.agentsLabel}</span>
                      <span className="font-bold text-sm" style={{ color: pack.color }}>${pack.price}/mo</span>
                    </div>
                    <div className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium text-center transition-all" style={{ background: `${pack.color}22`, color: pack.color }}>
                      {s.viewPack}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link href="/industry" className="px-8 py-3 rounded-2xl font-medium transition-all" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
              {s.viewAllPacks}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{s.featuresTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {s.features.map((f) => (
              <Link key={f.href} href={f.href} className="p-5 rounded-2xl transition-all hover:border-orange-500/30 group" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-3xl block mb-3">{f.icon}</span>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">{s.ctaTitle}</h2>
          <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>{s.ctaDesc}</p>
          <Link href="/register" className="inline-block px-10 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
            {s.ctaButton}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
        <p>{s.footer}</p>
      </footer>
    </div>
  );
}
