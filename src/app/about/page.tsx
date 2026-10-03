import PublicShell from "@/components/marketing/PublicShell";
import Link from "@/components/marketing/PublicLink";
import { prisma } from "@/lib/db/prisma";
import { Sparkles, Target, Users, Rocket } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { copy, text } from "@/lib/marketing/catalog";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  about_title: "درباره‌ی AiFekr",
  about_content:
    "AIFekr ابزارهای گفتگو، تولید تصویر، ویدئو و موسیقی را با فضای کسب‌وکار و یادگیری کنار هم قرار می‌دهد. هدف ما دسترسی ساده‌تر به هوش مصنوعی در جریان‌های کاری واقعی، با انتخاب و کنترل کاربر است.",
};

const DEFAULTS_EN = {
  about_title: "About AiFekr",
  about_content:
    "AIFekr brings chat, image, video and music tools together with business and learning workspaces. Our aim is to make AI easier to use in real workflows, with user choice and control.",
};

const DEFAULTS_DE = {
  about_title: "Über AiFekr",
  about_content:
    "AIFekr verbindet Chat-, Bild-, Video- und Musiktools mit Arbeitsbereichen für Unternehmen und Lernen. Unser Ziel ist ein einfacherer KI-Einsatz in echten Abläufen, mit Wahlmöglichkeiten und Kontrolle für Nutzer."
};

async function getSettings(lang: string) {
  const defaults = lang === "de" ? DEFAULTS_DE : lang === "tr" ? { about_title: "AIFekr hakkında", about_content: "AIFekr sohbet, görsel, video ve müzik üretimini, işletme araçlarını ve öğrenci çalışma alanını bir araya getiren bir yapay zekâ platformudur. Amacımız, gerçek iş akışlarında yapay zekâ kullanımını daha anlaşılır ve erişilebilir hale getirmektir." } : lang === "en" ? DEFAULTS_EN : DEFAULTS;
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["about_title", "about_content"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    // Only override with DB values when displaying Persian (DB content is Persian-authored);
    // otherwise fall back to the English defaults.
    return lang === "fa" ? { ...defaults, ...map } : defaults;
  } catch {
    return defaults;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/about", { fa: "درباره AIFekr؛ هوش مصنوعی برای کار و یادگیری", en: "About AIFekr: AI for work and learning", de: "Über AIFekr: KI für Arbeit und Lernen", tr: "AIFekr hakkında: iş ve öğrenim için yapay zekâ" }, { fa: "با AIFekr آشنا شوید: فضای یکپارچهٔ گفتگو، محتوا، CRM و مطالعه؛ با اعتبار مشخص، کنترل کاربر و بررسی خروجی‌های هوش مصنوعی.", en: "Meet AIFekr: a shared workspace for AI chat, content, CRM and learning, with clear credits, user control and review of AI output.", de: "AIFekr kennenlernen: ein gemeinsamer Bereich für KI-Chat, Inhalte, CRM und Lernen mit klaren Credits, Nutzerkontrolle und Prüfung der KI-Ausgaben.", tr: "AIFekr'i tanıyın: belirli krediler, kullanıcı kontrolü ve yapay zekâ çıktılarının incelenmesiyle sohbet, içerik, CRM ve öğrenim alanı." });
  return meta;
}

export default async function AboutPage() {
  const lang = await getServerLang();
  const isFa = lang === "fa";
  const s = await getSettings(lang);

  const cards = lang === "fa" ? [
    { icon: Target, title: "ماموریت ما", desc: "دسترسی ساده‌تر به ابزارهای AI برای کار و یادگیری." },
    { icon: Users, title: "برای چه کسانی؟", desc: "دانشجویان، تولیدکنندگان محتوا، متخصصان و تیم‌های کسب‌وکار." },
    { icon: Rocket, title: "نگاه ما", desc: "یک فضای متصل برای ابزارها و جریان‌های کاری، با کنترل کاربر." },
  ] : lang === "tr" ? [
    { icon: Target, title: "Misyonumuz", desc: "İş ve öğrenme için yapay zekâ araçlarına daha kolay erişim." },
    { icon: Users, title: "Kimler için?", desc: "Öğrenciler, içerik üreticileri, uzmanlar ve işletme ekipleri." },
    { icon: Rocket, title: "Vizyonumuz", desc: "Kullanıcının kontrolünde, araçlar ve iş akışları için bağlantılı bir alan." },
  ] : lang === "de"
    ? [
        { icon: Target, title: "Unsere Mission", desc: "KI-Werkzeuge für Arbeit und Lernen einfacher zugänglich machen, mit klaren Kapazitätsgrenzen." },
        { icon: Users, title: "Für wen?", desc: "Freelancer, Startups, Unternehmer und alle, die schneller mit KI arbeiten möchten." },
        { icon: Rocket, title: "Unsere Vision", desc: "Werkzeuge und Arbeitsabläufe verbinden, während Nutzer Entscheidungen und Ergebnisse kontrollieren." },
      ]
    : [
        { icon: Target, title: "Our Mission", desc: "Make AI tools easier to use for work and learning, with clear capacity limits." },
        { icon: Users, title: "Who It's For", desc: "Freelancers, startups, business owners, and anyone who wants to work faster with AI." },
        { icon: Rocket, title: "Our Vision", desc: "Connect tools and workflows while users stay in control of decisions and results." },
      ];

  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, "/about", "AboutPage")} />

      <section className="pt-12 pb-24 px-6 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(234,88,12,0.12)", color: "#ea580c" }}>
          <Sparkles className="w-3.5 h-3.5" />
          {lang === "tr" ? "Hikâyemiz" : lang === "de" ? "Unsere Geschichte" : isFa ? "داستان ما" : "Our Story"}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">{s.about_title}</h1>
        <p className="text-lg leading-8" style={{ color: "var(--text-secondary)" }}>{s.about_content}</p>
      </section>

      <section className="pb-24 px-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <item.icon className="w-8 h-8 mb-4" style={{ color: "#ea580c" }} />
            <h2 className="font-bold text-lg mb-2">{item.title}</h2>
            <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="pb-16 px-6 text-center">
        <Link
          href="/register"
          className="inline-block px-10 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
        >
          {text(lang, copy.start)}
        </Link>
      </section>
    </div></PublicShell>
  );
}
