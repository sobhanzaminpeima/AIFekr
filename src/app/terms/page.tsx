import PublicShell from "@/components/marketing/PublicShell";
import { getServerLang } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { LEGAL_META, legalPage } from "@/lib/marketing/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/terms", ...LEGAL_META.terms);
  return meta;
}

export default async function TermsPage() {
  const lang = await getServerLang();
  const isFa = lang === "fa";
  const SECTIONS = legalPage(lang, "terms").sections;

  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, "/terms")} />

      <section className="pt-12 pb-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{lang === "tr" ? "AIFekr kullanım koşulları" : lang === "de" ? "AiFekr Nutzungsbedingungen" : isFa ? "قوانین و مقررات استفاده از AiFekr" : "AiFekr Terms of Service"}</h1>
        <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>{lang === "tr" ? "Son güncelleme: Temmuz 2026" : lang === "de" ? "Zuletzt aktualisiert: Juli 2026" : isFa ? "آخرین به‌روزرسانی: تیر ۱۴۰۵" : "Last updated: July 2026"}</p>

        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold mb-2" style={{ color: "#ea580c" }}>{s.title}</h2>
              <p className="text-sm leading-7" style={{ color: "rgba(255,255,255,0.75)" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div></PublicShell>
  );
}
