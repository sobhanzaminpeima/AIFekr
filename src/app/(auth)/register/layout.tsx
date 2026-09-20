import type { Metadata } from "next";
import { getServerLang } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return pageMetadata(
    lang, "/register",
    { fa: "ثبت‌نام رایگان — تیم هوش مصنوعی خود را فعال کنید", en: "Sign Up Free — Activate Your AI Agent Team", de: "Kostenlos registrieren — KI-Agenten-Team aktivieren", tr: "Ücretsiz Kaydol — Yapay Zekâ Ekibinizi Etkinleştirin" },
    {
      fa: "در ۳۰ ثانیه حساب AiFekr بسازید و تیم عوامل هوش مصنوعی مخصوص کسب‌وکار خود را فعال کنید. بدون نیاز به کارت.",
      en: "Create your AiFekr account in 30 seconds and activate the AI agent team built for your business. No card required.",
      de: "Erstellen Sie Ihr AiFekr-Konto in 30 Sekunden und aktivieren Sie das KI-Agenten-Team für Ihr Unternehmen. Keine Karte nötig.",
      tr: "30 saniyede AiFekr hesabınızı oluşturun ve işletmenize özel yapay zekâ ajan ekibini etkinleştirin. Kart gerekmez.",
    },
  );
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
