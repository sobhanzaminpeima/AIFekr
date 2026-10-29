import PublicShell from "@/components/marketing/PublicShell";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
// tri must come from "@/lib/i18n/tri", NOT "@/lib/i18n": the index is a
// "use client" module, so a Server Component importing tri from it gets a
// client-reference proxy instead of the function and crashes at render.
import { tri } from "@/lib/i18n/tri";
import type { Metadata } from "next";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { getContactSettings } from "@/lib/marketing/contact";
import { CONTACT_DESCRIPTION, CONTACT_TITLE } from "@/lib/seo/publicSeo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/contact", CONTACT_TITLE, CONTACT_DESCRIPTION);
  return meta;
}

export default async function ContactPage() {
  const lang = await getServerLang();
  const isFa = lang === "fa";
  const s = await getContactSettings(lang);

  const cards = [
    { icon: Mail, label: lang === "tr" ? "E-posta" : lang === "de" ? "E-Mail" : isFa ? "ایمیل" : "Email", value: s.contact_email, href: `mailto:${s.contact_email}` },
    { icon: Phone, label: lang === "tr" ? "Telefon" : lang === "de" ? "Telefon" : isFa ? "تلفن" : "Phone", value: s.contact_phone, href: `tel:${s.contact_phone.replace(/[^0-9+]/g, "")}` },
    { icon: MessageCircle, label: lang === "de" ? "Telegram" : isFa ? "تلگرام" : "Telegram", value: s.contact_telegram, href: `https://t.me/${s.contact_telegram.replace("@", "")}` },
    { icon: MapPin, label: lang === "tr" ? "Adres" : lang === "de" ? "Adresse" : isFa ? "آدرس" : "Address", value: s.contact_address, href: undefined },
  ].filter(card => card.value);

  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, "/contact", "ContactPage")} />

      <section className="pt-12 pb-10 px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{tri(lang, "تماس با ما", "Contact Us", "Kontakt", "İletişim")}</h1>
        <p className="text-lg" style={{ color: "rgba(255,255,255,0.65)" }}>
          {lang === "tr" ? "Sorunuz mu var veya yardıma mı ihtiyacınız var? Aşağıdaki kanallardan AIFekr ekibine ulaşabilirsiniz." : lang === "de"
            ? "Haben Sie eine Frage oder benötigen Sie Hilfe? Sie können das AiFekr-Team über einen der folgenden Kanäle erreichen."
            : isFa
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
              {...(c.href ? { href: c.href, target: "_blank", rel: "noopener noreferrer" } : {})}
              className="p-6 rounded-2xl flex items-start gap-4 transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.12)" }}>
                <c.icon className="w-5 h-5" style={{ color: "#ea580c" }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{c.label}</div>
                <div className="font-medium break-all" dir="ltr">{c.value}</div>
              </div>
            </Wrapper>
          );
        })}
      </section>
    </div></PublicShell>
  );
}
