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
import EnamadBadge from "@/components/layout/EnamadBadge";
import AnimatedNavbar from "@/components/landing/AnimatedNavbar";
import NavLink, { NavCta } from "@/components/landing/NavLink";
import MobileMenu from "@/components/landing/MobileMenu";
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
import AiTeamTeaser from "@/components/landing/AiTeamTeaser";
import StartupBuilderTeaser from "@/components/landing/StartupBuilderTeaser";
import { getFxRates } from "@/lib/utils/currency";
import { planCodesForLang, sortByPlanLadder } from "@/lib/plans/catalog";
import type { Metadata } from "next";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";

const STR = {
  fa: {
    brand: "هوشمند AI",
    navPacks: "بسته‌های صنعتی",
    navPricing: "قیمت‌گذاری و پلن‌ها",
    navAbout: "درباره ما",
    navContact: "تماس با ما",
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
    bizPlansTitle: "پلن‌های کسب‌وکار",
    bizPlansSubtitle: "برای تیم‌ها، آژانس‌ها و سازمان‌ها — اعتبار مشترک برای همه اعضا",
    contactSales: "تماس با فروش",
    popularLabel: "محبوب‌ترین",
    freeLabel: "رایگان",
    perMonth: "تومان/ماه",
    viewAllPricing: "شروع رایگان و مشاهدهٔ همهٔ پکیج‌ها ←",
    faqTitle: "سوالات متداول",
    faqSubtitle: "پاسخ سوالات رایج شما اینجاست",
    faqs: [
      { q: "آیا نیاز به نصب چیزی هست؟", a: "خیر، AiFekr کاملاً تحت وب است و روی هر مرورگری اجرا می‌شود." },
      { q: "آیا داده‌های من امن هستند؟", a: "بله، تمام داده‌ها رمزنگاری شده و مطابق استانداردهای امنیتی نگهداری می‌شوند." },
      { q: "می‌توانم بسته را تغییر دهم؟", a: "بله، هر زمان می‌توانید بسته خود را ارتقا یا تغییر دهید." },
      { q: "آیا پشتیبانی فارسی دارید؟", a: "بله، تیم پشتیبانی به زبان فارسی در دسترس شماست." },
    ],
    aiTeamEyebrow: "جدید — سیستم‌عامل هوشمند کسب‌وکار",
    aiTeamTitle: "یک تیم کامل از عامل‌های هوش مصنوعی برای کسب‌وکارتان",
    aiTeamDesc: "۸ عامل تخصصی که با هم مقاله می‌نویسند و منتشر می‌کنند، به‌علاوه یک مدیرعامل هوش مصنوعی که وضعیت کل کسب‌وکار را تحلیل و اولویت‌بندی می‌کند — با حافظهٔ مشترک و جستجوی زندهٔ وب.",
    aiTeamAgents: ["ایده‌یاب", "استراتژیست", "پژوهشگر", "نویسنده", "ویراستار", "متخصص سئو", "ناشر", "منتقد"],
    aiTeamCta: "مشاهدهٔ کامل سیستم",
  },
  en: {
    brand: "AiFekr",
    navPacks: "Industry Packs",
    navPricing: "Pricing & Plans",
    navAbout: "About Us",
    navContact: "Contact Us",
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
    bizPlansTitle: "Business Plans",
    bizPlansSubtitle: "For teams, agencies and organizations — a shared credit pool for every member",
    contactSales: "Contact Sales",
    popularLabel: "Most Popular",
    freeLabel: "Free",
    perMonth: "/mo",
    viewAllPricing: "Get Started & See All Packages →",
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Answers to common questions",
    faqs: [
      { q: "Do I need to install anything?", a: "No, AiFekr is fully web-based and runs in any browser." },
      { q: "Is my data secure?", a: "Yes, all data is encrypted and stored according to security standards." },
      { q: "Can I change my plan?", a: "Yes, you can upgrade or change your plan at any time." },
      { q: "Do you offer support?", a: "Yes, our support team is available to help." },
    ],
    aiTeamEyebrow: "New — Autonomous Business Operating System",
    aiTeamTitle: "A full team of AI agents working for your business",
    aiTeamDesc: "8 specialized agents that write and publish articles together, plus an AI CEO that analyzes and prioritizes your whole business — with shared memory and live web research.",
    aiTeamAgents: ["Idea Finder", "Strategist", "Researcher", "Writer", "Editor", "SEO Expert", "Publisher", "Critic"],
    aiTeamCta: "See the full system",
  },
  tr: {
    brand: "AiFekr",
    navPacks: "Sektör Paketleri",
    navPricing: "Fiyatlandırma ve Planlar",
    navAbout: "Hakkımızda",
    navContact: "Bize Ulaşın",
    navLogin: "Giriş",
    navRegister: "Ücretsiz Başlayın",
    badge: "İşletmeler için Yapay Zeka Platformu",
    heroTitle1: "İşletmeniz İçin",
    heroTitle2: "Kurulmuş Bir Yapay Zeka Ekibi",
    heroDesc: "Her sektör için özel yapay zeka ajan paketleri — inşaattan kliniklere, restoranlardan otellere. Yapay zeka ajanlarınız 7/24 çalışır.",
    ctaStart: "Ücretsiz Başlayın →",
    ctaViewPacks: "Paketleri Görüntüle",
    howTitle: "Nasıl Çalışır",
    howSubtitle: "3 basit adımda",
    steps: [
      { step: "1", title: "Sektörünüzü Seçin", desc: "8 hazır sektör paketinden işletmeniz için doğru olanı seçin" },
      { step: "2", title: "Kayıt Olun", desc: "30 saniyede bir hesap oluşturun ve seçtiğiniz paketi etkinleştirin" },
      { step: "3", title: "Yapay Zeka Ajanlarını Devreye Alın", desc: "İşletmenize özel yapay zeka ajanları 7/24 çalışmaya başlar" },
    ],
    stepLabel: "Adım",
    packsTitle: "Sektör Paketleri",
    packsSubtitle: "Her paket, sektörünüze özel uzmanlaşmış bir yapay zeka ajan ekibi içerir",
    agentsLabel: "yapay zeka ajanı",
    viewPack: "Paketi Görüntüle →",
    viewAllPacks: "Tüm Paketleri Görüntüle",
    featuresTitle: "Yapay Zeka Araçları",
    features: [
      { title: "İşletme Doktoru", desc: "SWOT analizi, 90 günlük eylem planı, zayıflık tespiti", href: "/business-doctor" },
      { title: "CEO Danışmanı", desc: "Yönetici kararları için 20+ yıl deneyimli stratejik danışman", href: "/ceo" },
      { title: "SEO Çalışma Alanı", desc: "Anahtar kelime araştırması, URL analizi, içerik optimizasyonu", href: "/seo" },
      { title: "Sosyal Medya Ajanı", desc: "Instagram, LinkedIn, Twitter ve TikTok için içerik üretimi", href: "/social" },
      { title: "Yapay Zeka Web Sitesi Tasarımcısı", desc: "Tek tıkla eksiksiz profesyonel bir web sitesi tasarlayın ve kodlayın", href: "/website-designer" },
      { title: "Yapay Zeka Toplantı Odası", desc: "7 uzman ajanla stratejik bir toplantı simülasyonu yapın", href: "/meeting" },
    ],
    ctaTitle: "Başlamaya Hazır mısınız?",
    ctaDesc: "Şimdi sektör paketinizi seçin ve yapay zeka ajanlarınızı devreye alın",
    ctaButton: "Ücretsiz Başlayın — Hemen",
    footer: "© 2025 AiFekr — İşletmeler için Yapay Zeka Platformu",
    stats: [
      { label: "Aktif Ajan", value: "17" },
      { label: "Sektör Paketi", value: "8" },
      { label: "Çalışma Süresi", value: "%99.9" },
      { label: "Aktif Kullanıcı", value: "1.000+" },
    ],
    pricingTitle: "Şeffaf Fiyatlandırma",
    pricingSubtitle: "Gizli ücret yok — her şey açık",
    bizPlansTitle: "İşletme Planları",
    bizPlansSubtitle: "Ekipler, ajanslar ve kurumlar için — her üye için paylaşılan kredi havuzu",
    contactSales: "Satışla İletişime Geçin",
    popularLabel: "En Popüler",
    freeLabel: "Ücretsiz",
    perMonth: "/ay",
    viewAllPricing: "Ücretsiz Başlayın ve Tüm Paketleri Görün →",
    faqTitle: "Sıkça Sorulan Sorular",
    faqSubtitle: "Yaygın sorulara cevaplar",
    faqs: [
      { q: "Bir şey kurmam gerekiyor mu?", a: "Hayır, AiFekr tamamen web tabanlıdır ve herhangi bir tarayıcıda çalışır." },
      { q: "Verilerim güvende mi?", a: "Evet, tüm veriler güvenlik standartlarına göre şifrelenir ve saklanır." },
      { q: "Planımı değiştirebilir miyim?", a: "Evet, planınızı istediğiniz zaman yükseltebilir veya değiştirebilirsiniz." },
      { q: "Destek sunuyor musunuz?", a: "Evet, destek ekibimiz yardımcı olmak için hazır." },
    ],
    aiTeamEyebrow: "Yeni — Otonom İşletme İşletim Sistemi",
    aiTeamTitle: "İşletmeniz için çalışan tam bir yapay zeka ajan ekibi",
    aiTeamDesc: "Birlikte makale yazıp yayınlayan 8 uzman ajan, artı tüm işletmenizi analiz edip önceliklendiren bir yapay zeka CEO'su — paylaşılan hafıza ve canlı web araştırmasıyla.",
    aiTeamAgents: ["Fikir Bulucu", "Stratejist", "Araştırmacı", "Yazar", "Editör", "SEO Uzmanı", "Yayıncı", "Eleştirmen"],
    aiTeamCta: "Tüm sistemi görün",
  },
  de: {
    brand: "AiFekr",
    navPacks: "Branchenpakete",
    navPricing: "Preise & Pläne",
    navAbout: "Über uns",
    navContact: "Kontakt",
    navLogin: "Anmelden",
    navRegister: "Kostenlos starten",
    badge: "KI-Plattform für Unternehmen",
    heroTitle1: "Ein KI-Team",
    heroTitle2: "Für Ihr Unternehmen",
    heroDesc: "Spezialisierte KI-Agentenpakete für jede Branche — vom Bauwesen bis zu Kliniken, von Restaurants bis Hotels. Ihre KI-Agenten arbeiten rund um die Uhr.",
    ctaStart: "Kostenlos starten →",
    ctaViewPacks: "Pakete ansehen",
    howTitle: "So funktioniert es",
    howSubtitle: "In 3 einfachen Schritten",
    steps: [
      { step: "1", title: "Branche wählen", desc: "Wählen Sie das passende Paket für Ihr Unternehmen aus 8 fertigen Branchenpaketen" },
      { step: "2", title: "Registrieren", desc: "Erstellen Sie in 30 Sekunden ein Konto und aktivieren Sie Ihr gewähltes Paket" },
      { step: "3", title: "KI-Agenten einsetzen", desc: "Auf Ihr Unternehmen zugeschnittene KI-Agenten arbeiten ab sofort rund um die Uhr" },
    ],
    stepLabel: "Schritt",
    packsTitle: "Branchenpakete",
    packsSubtitle: "Jedes Paket enthält ein Team von KI-Agenten, spezialisiert auf Ihre Branche",
    agentsLabel: "KI-Agenten",
    viewPack: "Paket ansehen →",
    viewAllPacks: "Alle Pakete ansehen",
    featuresTitle: "KI-Tools",
    features: [
      { title: "Business-Doktor", desc: "SWOT-Analyse, 90-Tage-Aktionsplan, Schwachstellenerkennung", href: "/business-doctor" },
      { title: "CEO-Berater", desc: "Strategischer Berater mit über 20 Jahren Erfahrung für Führungsentscheidungen", href: "/ceo" },
      { title: "SEO-Arbeitsbereich", desc: "Keyword-Recherche, URL-Analyse, Content-Optimierung", href: "/seo" },
      { title: "Social-Media-Agent", desc: "Content-Erstellung für Instagram, LinkedIn, Twitter und TikTok", href: "/social" },
      { title: "KI-Website-Designer", desc: "Entwerfen und programmieren Sie eine komplette professionelle Website mit einem Klick", href: "/website-designer" },
      { title: "KI-Besprechungsraum", desc: "Simulieren Sie eine strategische Besprechung mit 7 Fachagenten", href: "/meeting" },
    ],
    ctaTitle: "Bereit loszulegen?",
    ctaDesc: "Wählen Sie jetzt Ihr Branchenpaket und setzen Sie Ihre KI-Agenten ein",
    ctaButton: "Jetzt kostenlos starten",
    footer: "© 2025 AiFekr — KI-Plattform für Unternehmen",
    stats: [
      { label: "Aktive Agenten", value: "17" },
      { label: "Branchenpakete", value: "8" },
      { label: "Verfügbarkeit", value: "99,9%" },
      { label: "Aktive Nutzer", value: "1.000+" },
    ],
    pricingTitle: "Transparente Preise",
    pricingSubtitle: "Keine versteckten Kosten — alles ist klar",
    bizPlansTitle: "Business-Pläne",
    bizPlansSubtitle: "Für Teams, Agenturen und Unternehmen — ein gemeinsamer Guthaben-Pool für jedes Mitglied",
    contactSales: "Vertrieb kontaktieren",
    popularLabel: "Am beliebtesten",
    freeLabel: "Kostenlos",
    perMonth: "/Monat",
    viewAllPricing: "Kostenlos starten & alle Pakete ansehen →",
    faqTitle: "Häufig gestellte Fragen",
    faqSubtitle: "Antworten auf häufige Fragen",
    faqs: [
      { q: "Muss ich etwas installieren?", a: "Nein, AiFekr ist vollständig webbasiert und läuft in jedem Browser." },
      { q: "Sind meine Daten sicher?", a: "Ja, alle Daten werden verschlüsselt und gemäß Sicherheitsstandards gespeichert." },
      { q: "Kann ich meinen Plan ändern?", a: "Ja, Sie können Ihren Plan jederzeit upgraden oder ändern." },
      { q: "Bieten Sie Support an?", a: "Ja, unser Support-Team steht Ihnen gerne zur Verfügung." },
    ],
    aiTeamEyebrow: "Neu — Autonomes Business-Betriebssystem",
    aiTeamTitle: "Ein komplettes Team von KI-Agenten für Ihr Unternehmen",
    aiTeamDesc: "8 spezialisierte Agenten, die gemeinsam Artikel schreiben und veröffentlichen, plus ein KI-Geschäftsführer, der Ihr gesamtes Unternehmen analysiert und priorisiert — mit gemeinsamem Gedächtnis und Live-Webrecherche.",
    aiTeamAgents: ["Ideenfinder", "Stratege", "Rechercheur", "Autor", "Lektor", "SEO-Experte", "Publisher", "Kritiker"],
    aiTeamCta: "Das gesamte System ansehen",
  },
};

// Same team/business tiers /plans sells (see BIZ_PLANS_IR/BIZ_PLANS_USD
// there) -- duplicated here rather than imported since /plans lives under
// the authenticated (dashboard) layout and can't be rendered from this
// public page; kept in sync manually when those prices change.
const BIZ_PLANS_IR = [
  { planCode: "TEAM_STARTER", name: "تیم کوچک", desc: "تا ۵ کاربر", price: 39000000, color: "#6366f1", features: ["فضای کار تیمی", "استخر اعتبار مشترک", "گزارش مصرف تیم"] },
  { planCode: "TEAM_GROWTH", name: "تیم متوسط", desc: "تا ۲۰ کاربر", price: 119000000, color: "#ea580c", features: ["فضای کار تیمی پیشرفته", "استخر اعتبار مشترک", "گزارش مصرف تیم"], popular: true },
  { name: "سازمانی", desc: "بدون محدودیت", price: null, color: "#8b5cf6", features: ["همه امکانات الفا برای هر عضو", "استقرار اختصاصی", "پشتیبانی ۲۴/۷"] },
];

const BIZ_PLANS_USD = [
  { planCode: "TEAM_STARTER", name: "Startup", desc: "Up to 5 users", priceUsd: 14900, color: "#6366f1", features: ["Team workspace", "Shared credit pool", "Team usage reports"] },
  { planCode: "TEAM_GROWTH", name: "Growth", desc: "Up to 20 users", priceUsd: 44900, color: "#ea580c", features: ["Advanced team workspace", "Shared credit pool", "Team usage reports"], popular: true },
  { name: "Enterprise", desc: "Unlimited", priceUsd: null, color: "#8b5cf6", features: ["All Ultra features per seat", "Custom deployment", "24/7 support"] },
];

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/", {"fa":"AiFekr — عوامل هوش مصنوعی برای کسب‌وکار شما | CRM، سئو و بیشتر","en":"AiFekr — AI Agents for Your Business | CRM, Chat, SEO & More","de":"AiFekr — KI-Agenten für Ihr Unternehmen | CRM, Chat, SEO & mehr","tr":"AiFekr — İşletmeniz için Yapay Zekâ Ajanları | CRM, Sohbet, SEO"}, {"fa":"بسته‌های هوش مصنوعی ویژه هر صنعت — CRM، حسابداری، تولید محتوا، سئو و دستیار صوتی. تیم AI شما ۲۴ ساعته کار می‌کند. رایگان شروع کنید.","en":"Dedicated AI agent packs for every industry — CRM, accounting, content, SEO and voice. Your AI team works 24/7. Start free today.","de":"Branchenspezifische KI-Agenten-Pakete — CRM, Buchhaltung, Content, SEO und Voice. Ihr KI-Team arbeitet rund um die Uhr. Jetzt kostenlos starten.","tr":"Her sektöre özel yapay zekâ ajan paketleri — CRM, muhasebe, içerik, SEO ve sesli asistan. Yapay zekâ ekibiniz 7/24 çalışır. Ücretsiz başlayın."});
  // The landing page keeps its full, keyword-rich title (no " | AiFekr" template suffix).
  meta.title = { absolute: String(meta.title) };
  return meta;
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const { redirect } = await import("next/navigation");
      // Land on the business overview, not an empty chat box: the first thing
      // a signed-in owner should see is the state of their business and what
      // is overdue, not a blinking cursor.
      redirect("/home");
    }
  }

  // These were awaited one after another; they are independent, and the packs query needs neither.
  const packsQuery = prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 8 }).catch(() => null);
  const [lang, fxRates] = await Promise.all([getServerLang(), getFxRates()]);
  const s = STR[lang];
  const dir = lang === "fa" ? "rtl" : "ltr";

  let packs: { id: string; slug: string; name: string; nameEn: string | null; emoji: string; tagline: string; taglineEn: string | null; agents: string; tier: string; price: number; color: string; gradientFrom: string; gradientTo: string }[] = [];
  const fetchedPacks = await packsQuery;
  if (fetchedPacks) packs = fetchedPacks;
  const localizedPacks = packs.map((p) => ({
    ...p,
    name: lang !== "fa" && p.nameEn ? p.nameEn : p.name,
    tagline: lang !== "fa" && p.taglineEn ? p.taglineEn : p.tagline,
  }));

  let packages: { planCode: string; name: string; nameEn: string; price: number; priceUsd: number | null; credits: number; features: string; featuresEn: string | null; isFeatured: boolean; color: string }[] = [];
  try {
    // Same plan codes /plans sells, for the same market — see lib/plans/catalog.
    // Previously "first 3 active by sortOrder" with no market filter, which
    // advertised the legacy BASIC/PRO/TEAM rows here while /plans sold
    // ECHO/PLUS/ALPHA, and rendered Rial-only plans as "Free" to international
    // visitors (their priceUsd is null).
    const codes = planCodesForLang(lang);
    const active = await prisma.package.findMany({ where: { isActive: true, planCode: { in: codes } } });
    packages = sortByPlanLadder(active, codes).slice(0, 3);
  } catch {}
  const pricingPlans = packages.map((p) => {
    // Package.features is stored as plain newline-separated text (see admin
    // package editor), not JSON — parse accordingly, with a JSON fallback
    // in case any row was ever entered as a JSON array.
    let features: string[] = [];
    // German is not "en", so this used to hand a German visitor the PERSIAN
    // feature list on the highest-traffic page on the site. There is no
    // featuresDe column yet, so German gets the English list -- which is what
    // the plan NAME on the next line already does.
    const raw = (lang !== "fa" && p.featuresEn ? p.featuresEn : p.features)?.trim() || "";
    if (raw.startsWith("[")) {
      try { features = JSON.parse(raw); } catch {}
    } else if (raw) {
      features = raw.split("\n").map((f) => f.trim()).filter(Boolean);
    }
    return {
      planCode: p.planCode,
      name: lang === "fa" ? p.name : p.nameEn,
      nameEn: p.nameEn,
      price: p.price,
      priceUsd: p.priceUsd ?? null,
      credits: p.credits,
      features,
      isFeatured: p.isFeatured,
      color: p.color,
    };
  });


  return (
    <div className="min-h-screen" dir={dir} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      {/* Structured data: only facts we can stand behind (no ratings, prices or review counts). */}
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: lang },
          {
            "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, url: SITE_URL,
            applicationCategory: "BusinessApplication", operatingSystem: "Web",
            description: "AI agent packs for every industry: CRM, accounting, content, SEO and voice.",
          },
        ]}
      />
      {/* Navbar */}
      <AnimatedNavbar>
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-lg blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300"
              style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
            />
            <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="relative rounded-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
          </div>
          <span
            className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #ffffff, #d4d4d8)" }}
          >
            AiFekr
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="#pricing">{s.navPricing}</NavLink>
          <NavLink href="/industry">{s.navPacks}</NavLink>
          <NavLink href="/about">{s.navAbout}</NavLink>
          <NavLink href="/contact">{s.navContact}</NavLink>
          <NavLink href="/login">{s.navLogin}</NavLink>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
          <CurrencySelector />
          <LanguageSwitcher />
          <NavCta href="/register">{s.navRegister}</NavCta>
        </div>
        <MobileMenu
          items={[
            { href: "#pricing", label: s.navPricing },
            { href: "/industry", label: s.navPacks },
            { href: "/about", label: s.navAbout },
            { href: "/contact", label: s.navContact },
            { href: "/login", label: s.navLogin },
          ]}
          ctaHref="/register"
          ctaLabel={s.navRegister}
        />
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
          <PackGrid packs={localizedPacks} agentsLabel={s.agentsLabel} viewPack={s.viewPack} lang={lang} fxRates={fxRates} />
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

      {/* AI Team / Business OS teaser */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <AiTeamTeaser
            eyebrow={s.aiTeamEyebrow}
            title={s.aiTeamTitle}
            desc={s.aiTeamDesc}
            agentNames={s.aiTeamAgents}
            ctaLabel={s.aiTeamCta}
            ctaHref="/ai-team"
          />
        </div>
      </section>

      {/* Startup Builder Teaser */}
      <StartupBuilderTeaser lang={lang} />

      {/* Pricing */}
      {pricingPlans.length > 0 && (
        <section id="pricing" className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
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
              lang={lang}
              usdToTry={fxRates.usdToTry}
            />
          </div>
        </section>
      )}

      {/* Business Plans */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-4">{s.bizPlansTitle}</h2>
            <p className="text-center mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>{s.bizPlansSubtitle}</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(lang === "fa" ? BIZ_PLANS_IR : BIZ_PLANS_USD).map((biz) => (
              <Reveal key={biz.name}>
                <div
                  className="relative p-6 rounded-2xl h-full flex flex-col"
                  style={{
                    background: biz.popular ? `${biz.color}12` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${biz.popular ? biz.color : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {biz.popular && (
                    <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white whitespace-nowrap" style={{ background: biz.color }}>
                      {s.popularLabel}
                    </div>
                  )}
                  <div className="font-bold text-lg mb-1" style={{ color: biz.color }}>{biz.name}</div>
                  <div className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{biz.desc}</div>
                  <div className="text-2xl font-bold mb-4">
                    {"price" in biz && biz.price != null
                      ? `${Math.round(biz.price / 10).toLocaleString("fa-IR")} تومان`
                      : "priceUsd" in biz && biz.priceUsd != null
                      ? `$${(biz.priceUsd / 100).toLocaleString()}`
                      : s.contactSales}
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {biz.features.map((f) => (
                      <li key={f} className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>• {f}</li>
                    ))}
                  </ul>
                  <Link
                    href={(("price" in biz && biz.price == null) || ("priceUsd" in biz && biz.priceUsd == null)) ? "/contact" : `/register?plan=${encodeURIComponent((biz as { planCode: string }).planCode)}&period=monthly`}
                    className="text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: biz.color }}
                  >
                    {(("price" in biz && biz.price == null) || ("priceUsd" in biz && biz.priceUsd == null)) ? s.contactSales : s.navRegister}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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
        <EnamadBadge />
        <p>{s.footer}</p>
      </footer>
    </div>
  );
}
