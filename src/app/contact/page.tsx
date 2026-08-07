import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  contact_email: "support@aifekr.com",
  contact_phone: "021-12345678",
  contact_address: "تهران، ایران",
  contact_telegram: "@aifekr_support",
};

const DEFAULTS_EN = {
  contact_email: "support@aifekr.com",
  contact_phone: "021-12345678",
  contact_address: "Tehran, Iran",
  contact_telegram: "@aifekr_support",
};

async function getSettings(isFa: boolean) {
  const defaults = isFa ? DEFAULTS : DEFAULTS_EN;
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["contact_email", "contact_phone", "contact_address", "contact_telegram"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    // The address field from the DB is Persian-authored, so only apply DB overrides in Persian mode.
    return isFa ? { ...defaults, ...map } : { ...defaults, ...map, contact_address: defaults.contact_address };
  } catch {
    return defaults;
  }
}

export default async function ContactPage() {
  const lang = await getServerLang();
  const isFa = lang !== "en";
  const s = await getSettings(isFa);

  const cards = [
    { icon: Mail, label: isFa ? "ایمیل" : "Email", value: s.contact_email, href: `mailto:${s.contact_email}` },
    { icon: Phone, label: isFa ? "تلفن" : "Phone", value: s.contact_phone, href: `tel:${s.contact_phone.replace(/[^0-9+]/g, "")}` },
    { icon: MessageCircle, label: isFa ? "تلگرام" : "Telegram", value: s.contact_telegram, href: `https://t.me/${s.contact_telegram.replace("@", "")}` },
    { icon: MapPin, label: isFa ? "آدرس" : "Address", value: s.contact_address, href: undefined },
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
          <Link href="/about" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "درباره ما" : "About"}</Link>
          <Link href="/contact" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "#ea580c" }}>{isFa ? "تماس با ما" : "Contact"}</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "ورود" : "Log in"}</Link>
          <Link href="/register" className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all" style={{ background: "#ea580c" }}>{isFa ? "ثبت‌نام" : "Sign up"}</Link>
        </div>
      </nav>

      <section className="pt-40 pb-10 px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFa ? "تماس با ما" : "Contact Us"}</h1>
        <p className="text-lg" style={{ color: "rgba(255,255,255,0.65)" }}>
          {isFa
            ? "سؤالی داری یا نیاز به راهنمایی داری؟ از هر کدام از راه‌های زیر می‌توانی با تیم AiFekr در ارتباط باشی."
            : "Have a question or need help? You can reach the AiFekr team through any of the channels below."}
        </p>
      </section>

      <section className="pb-24 px-6 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {cards.map((c, i) => {
          const Wrapper = c.href ? "a" : "div";
          return (
            <Wrapper
              key={i}
              {...(c.href ? { href: c.href, target: "_blank" } : {})}
              className="p-6 rounded-2xl flex items-start gap-4 transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.12)" }}>
                <c.icon className="w-5 h-5" style={{ color: "#ea580c" }} />
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{c.label}</div>
                <div className="font-medium" dir="ltr">{c.value}</div>
              </div>
            </Wrapper>
          );
        })}
      </section>

      <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <SocialFooterLinks />
      </footer>
    </div>
  );
}
