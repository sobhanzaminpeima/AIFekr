import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import CurrencySelector from "@/components/ui/CurrencySelector";
import DemoChat from "@/components/landing/DemoChat";
import Image from "next/image";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import AnimatedNavbar from "@/components/landing/AnimatedNavbar";
import HeroBackground from "@/components/landing/HeroBackground";
import HeroContent from "@/components/landing/HeroContent";
import Reveal from "@/components/landing/Reveal";
import StepGrid from "@/components/landing/StepGrid";
import PackGrid from "@/components/landing/PackGrid";
import FeatureGrid from "@/components/landing/FeatureGrid";
import FinalCta from "@/components/landing/FinalCta";
import StatsBar from "@/components/landing/StatsBar";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";

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
    ctaStart: "شروع رایگان ←",
    ctaViewPacks: "مشاهده بسته‌ها",
    howTitle: "چطور کار می‌کند؟",
    howSubtitle: "در ۳ مرحله ساده",
    steps: [
      { step: "۱", title: "صنعت خود را انتخاب کنید", desc: "از ۸ بسته صنعتی آماده، بسته مناسب کسب‌وکار خود را انتخاب کنید" },
      { step: "۲", title: "ثبت‌نام کنید", desc: "در ۳۰ ثانیه حساب کاربری بسازید و بسته انتخابی را فعال کنید" },
      { step: "۳", title: "عوامل AI را به کار بگیرید", desc: "عوامل هوش مصنوعی مخصوص کسب‌وکار شما ۲۴/۷ شروع به کار می‌کنند" },
    ],
    stepLabel: "مرحله",
    packsTitle: "بسته‌های صنعتی",
    packsSubtitle: "هر بسته شامل تیمی از عوامل AI متخصص صنعت شماست",
    agentsLabel: "عامل AI",
    viewPack: "مشاهده بسته ←",
    viewAllPacks: "مشاهده همه بسته‌ها",
    featuresTitle: "ابزارهای هوش مصنوعی",
    features: [
      { title: "دکتر کسب‌وکار", desc: "تحلیل SWOT، برنامه اقدام ۹۰ روزه، شناسایی نقاط ضعف", href: "/business-doctor" },
      { title: "مشاور مدیرعامل", desc: "مشاور استراتژیک با ۲۰+ سال تجربه برای تصمیمات اجرایی", href: "/ceo" },
      { title: "فضای کار سئو", desc: "تحقیق کلمات کلیدی، آنالیز URL، بهینه‌سازی محتوا", href: "/seo" },
      { title: "عامل شبکه اجتماعی", desc: "تولید محتوا برای اینستاگرام، لینکدین، توییتر و تیک‌تاک", href: "/social" },
      { title: "طراح وبسایت AI", desc: "طراحی و کدنویسی وبسایت حرفه‌ای کامل با یک کلیک", href: "/website-designer" },
      { title: "اتاق جلسه AI", desc: "شبیه‌سازی جلسه استراتژیک با ۷ عامل متخصص", href: "/meeting" },
    ],
    ctaTitle: "آماده شروع هستید؟",
    ctaDesc: "همین الان بسته صنعتی خود را انتخاب کنید و عوامل AI را به کار بگیرید",
    ctaButton: "شروع رایگان — همین الان",
    footer: "© ۲۰۲۵ AiFekr — پلتفرم هوش مصنوعی کسب‌وکار",
    stats: [
      { label: "ایجنت فعال", value: "۱۷" },
      { label: "بسته صنعتی", value: "۸" },
      { label: "آپتایم", value: "٪۹۹.۹" },
      { label: "کاربر فعال", value: "+۱۰۰۰" },
    ],
    pricingTitle: "قیمت‌گذاری شفاف",
    pricingSubtitle: "بدون هزینه پنهان — همه چیز روشن است",
    popularLabel: "محبوب‌ترین",
    freeLabel: "رایگان",
    perMonth: "تومان/ماه",
    viewAllPricing: "مشاهده همه پکیج‌ها ←",
    faqTitle: "سوالات متداول",
    faqSubtitle: "پاسخ سوالات رایج شما اینجاست",
    faqs: [
      { q: "آیا نیاز به نصب چیزی هست؟", a: "خیر، AiFekr کاملاً تحت وب است و روی هر مرورگری اجرا می‌شود." },
      { q: "آیا داده‌های من امن هستند؟", a: "بله، تمام داده‌ها رمزنگاری شده و مطابق استانداردهای امنیتی نگهداری می‌شوند." },
      { q: "می‌توانم بسته را تغییر دهم؟", a: "بله، هر زمان می‌توانید بسته خود را ارتقا یا تغییر دهید." },
      { q: "آیا پشتیبانی فارسی دارید؟", a: "بله، تیم پشتیبانی به زبان فارسی در دسترس شماست." },
    ],
  },
  en: {
    brand: "AiFekr",
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
      { step: "1", title: "Choose Your Industry", desc: "Pick the right pack for your business from 8 ready-made industry packs" },
      { step: "2", title: "Sign Up", desc: "Create an account in 30 seconds and activate your chosen pack" },
      { step: "3", title: "Deploy AI Agents", desc: "AI agents tailored to your business start working 24/7" },
    ],
    stepLabel: "Step",
    packsTitle: "Industry Packs",
    packsSubtitle: "Each pack includes a team of AI agents specialized for your industry",
    agentsLabel: "AI agents",
    viewPack: "View Pack →",
    viewAllPacks: "View All Packs",
    featuresTitle: "AI Tools",
    features: [
      { title: "Business Doctor", desc: "SWOT analysis, 90-day action plan, weakness detection", href: "/business-doctor" },
      { title: "CEO Advisor", desc: "Strategic advisor with 20+ years of experience for executive decisions", href: "/ceo" },
      { title: "SEO Workspace", desc: "Keyword research, URL analysis, content optimization", href: "/seo" },
      { title: "Social Media Agent", desc: "Content generation for Instagram, LinkedIn, Twitter and TikTok", href: "/social" },
      { title: "AI Website Designer", desc: "Design and code a complete professional website with one click", href: "/website-designer" },
      { title: "AI Meeting Room", desc: "Simulate a strategic meeting with 7 specialist agents", href: "/meeting" },
    ],
    ctaTitle: "Ready to Get Started?",
    ctaDesc: "Choose your industry pack now and deploy your AI agents",
    ctaButton: "Get Started Free — Now",
    footer: "© 2025 AiFekr — AI Platform for Business",
    stats: [
      { label: "Active Agents", value: "17" },
      { label: "Industry Packs", value: "8" },
      { label: "Uptime", value: "99.9%" },
      { label: "Active Users", value: "1,000+" },
    ],
    pricingTitle: "Transparent Pricing",
    pricingSubtitle: "No hidden fees — everything is clear",
    popularLabel: "Most Popular",
    freeLabel: "Free",
    perMonth: "/mo",
    viewAllPricing: "View All Packages →",
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Answers to common questions",
    faqs: [
      { q: "Do I need to install anything?", a: "No, AiFekr is fully web-based and runs in any browser." },
      { q: "Is my data secure?", a: "Yes, all data is encrypted and stored according to security standards." },
      { q: "Can I change my plan?", a: "Yes, you can upgrade or change your plan at any time." },
      { q: "Do you offer support?", a: "Yes, our support team is available to help." },
    ],
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

  let packages: { planCode: string; name: string; nameEn: string; price: number; credits: number; features: string; isFeatured: boolean; color: string }[] = [];
  try {
    packages = await prisma.package.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 3 });
  } catch {}
  const pricingPlans = packages.map((p) => {
    let features: string[] = [];
    try { features = JSON.parse(p.features); } catch {}
    return {
      planCode: p.planCode,
      name: lang === "fa" ? p.name : p.nameEn,
      price: p.price,
      credits: p.credits,
      features,
      isFeatured: p.isFeatured,
      color: p.color,
    };
  });


  return (
    <div className="min-h-screen" dir={dir} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      {/* Navbar */}
      <AnimatedNavbar>
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg text-white">AiFekr</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/industry" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{s.navPacks}</Link>
          <Link href="/about" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>درباره ما</Link>
          <Link href="/contact" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>تماس با ما</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{s.navLogin}</Link>
          <Link href="/register" className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all" style={{ background: "#ea580c" }}>{s.navRegister}</Link>
          <CurrencySelector />
          <LanguageSwitcher />
        </div>
      </AnimatedNavbar>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <HeroBackground />
        <HeroContent
          badge={s.badge}
          title1={s.heroTitle1}
          title2={s.heroTitle2}
          desc={s.heroDesc}
          ctaStart={s.ctaStart}
          ctaViewPacks={s.ctaViewPacks}
        />
      </section>

      {/* Stats */}
      <section className="px-6 pb-20">
        <Reveal>
          <StatsBar stats={s.stats} />
        </Reveal>
      </section>

      {/* Demo Chat */}
      <Reveal y={16}>
        <DemoChat lang={lang} />
      </Reveal>

      {/* How it works */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-4">{s.howTitle}</h2>
            <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.howSubtitle}</p>
          </Reveal>
          <StepGrid steps={s.steps} stepLabel={s.stepLabel} />
        </div>
      </section>

      {/* Industry Packs */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-4">{s.packsTitle}</h2>
            <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.packsSubtitle}</p>
          </Reveal>
          <PackGrid packs={packs} agentsLabel={s.agentsLabel} viewPack={s.viewPack} />
          <Reveal delay={0.1}>
            <div className="text-center mt-10">
              <Link href="/industry" className="px-8 py-3 rounded-2xl font-medium transition-all" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                {s.viewAllPacks}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-12">{s.featuresTitle}</h2>
          </Reveal>
          <FeatureGrid features={s.features} />
        </div>
      </section>

      {/* Pricing */}
      {pricingPlans.length > 0 && (
        <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <h2 className="text-3xl font-bold text-center mb-4">{s.pricingTitle}</h2>
              <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.pricingSubtitle}</p>
            </Reveal>
            <PricingSection
              plans={pricingPlans}
              popularLabel={s.popularLabel}
              freeLabel={s.freeLabel}
              perMonth={s.perMonth}
              startButton={s.navRegister}
              viewAll={s.viewAllPricing}
              viewAllHref="/register"
            />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-4">{s.faqTitle}</h2>
            <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.faqSubtitle}</p>
          </Reveal>
          <FaqSection faqs={s.faqs} />
        </div>
      </section>

      {/* CTA */}
      <FinalCta title={s.ctaTitle} desc={s.ctaDesc} button={s.ctaButton} />

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
        <SocialFooterLinks />
        <p>{s.footer}</p>
      </footer>
    </div>
  );
}
