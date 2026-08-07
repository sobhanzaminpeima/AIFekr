import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { Sparkles, Target, Users, Rocket } from "lucide-react";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  about_title: "درباره‌ی AiFekr",
  about_content:
    "AiFekr یک پلتفرم هوش مصنوعی فارسی‌زبان است که خدمات پیشرفته‌ی هوش مصنوعی — از چت هوشمند و تولید تصویر/ویدیو/موزیک تا ابزارهای تخصصی کسب‌وکار — را در یک محصول یکپارچه و کاملاً فارسی در اختیار کاربران ایرانی قرار می‌دهد. ماموریت ما این است که هوش مصنوعی روز دنیا را بدون پیچیدگی، بدون نیاز به فیلترشکن، و متناسب با نیاز واقعی کسب‌وکارها و کاربران فارسی‌زبان در دسترس همه قرار دهیم.",
};

const DEFAULTS_EN = {
  about_title: "About AiFekr",
  about_content:
    "AiFekr is a Persian-language AI platform that brings advanced artificial intelligence services — from smart chat and image/video/music generation to specialized business tools — together in one unified, fully localized product for Iranian users. Our mission is to make world-class AI accessible to everyone without complexity, without needing a VPN, and tailored to the real needs of Persian-speaking businesses and users.",
};

async function getSettings(isFa: boolean) {
  const defaults = isFa ? DEFAULTS : DEFAULTS_EN;
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["about_title", "about_content"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    // Only override with DB values when displaying Persian (DB content is Persian-authored);
    // otherwise fall back to the English defaults.
    return isFa ? { ...defaults, ...map } : defaults;
  } catch {
    return defaults;
  }
}

export default async function AboutPage() {
  const lang = await getServerLang();
  const isFa = lang !== "en";
  const s = await getSettings(isFa);

  const cards = isFa
    ? [
        { icon: Target, title: "ماموریت ما", desc: "دسترسی ساده و بدون‌مانع به قوی‌ترین ابزارهای هوش مصنوعی برای هر کسب‌وکار ایرانی." },
        { icon: Users, title: "برای چه کسانی؟", desc: "فریلنسرها، استارتاپ‌ها، صاحبان کسب‌وکار و هر کسی که می‌خواهد با هوش مصنوعی سریع‌تر کار کند." },
        { icon: Rocket, title: "چشم‌انداز", desc: "تبدیل شدن به همراه هوش مصنوعی شماره‌ی یک کسب‌وکارهای فارسی‌زبان در منطقه." },
      ]
    : [
        { icon: Target, title: "Our Mission", desc: "Simple, unrestricted access to the most powerful AI tools for every Iranian business." },
        { icon: Users, title: "Who It's For", desc: "Freelancers, startups, business owners, and anyone who wants to work faster with AI." },
        { icon: Rocket, title: "Our Vision", desc: "Becoming the number-one AI companion for Persian-speaking businesses in the region." },
      ];

  return (
    <div className="min-h-screen" dir={isFa ? "rtl" : "ltr"} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg text-white">AiFekr</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/about" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "#ea580c" }}>{isFa ? "درباره ما" : "About"}</Link>
          <Link href="/contact" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "تماس با ما" : "Contact"}</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "ورود" : "Log in"}</Link>
          <Link href="/register" className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all" style={{ background: "#ea580c" }}>{isFa ? "ثبت‌نام" : "Sign up"}</Link>
        </div>
      </nav>

      <section className="pt-40 pb-24 px-6 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(234,88,12,0.12)", color: "#ea580c" }}>
          <Sparkles className="w-3.5 h-3.5" />
          {isFa ? "داستان ما" : "Our Story"}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">{s.about_title}</h1>
        <p className="text-lg leading-8" style={{ color: "rgba(255,255,255,0.75)" }}>{s.about_content}</p>
      </section>

      <section className="pb-24 px-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <item.icon className="w-8 h-8 mb-4" style={{ color: "#ea580c" }} />
            <h3 className="font-bold text-lg mb-2">{item.title}</h3>
            <p className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.6)" }}>{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="pb-16 px-6 text-center">
        <Link
          href="/register"
          className="inline-block px-10 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
        >
          {isFa ? "همین حالا رایگان شروع کن" : "Start Free Right Now"}
        </Link>
      </section>

      <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <SocialFooterLinks />
      </footer>
    </div>
  );
}
