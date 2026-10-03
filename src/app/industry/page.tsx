import PublicShell from "@/components/marketing/PublicShell";
import Link from "@/components/marketing/PublicLink";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { publicAlternates, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const title = lang === "fa" ? "بازار بسته‌های صنعتی هوش مصنوعی — عوامل AI برای هر صنعت | AiFekr" : lang === "de" ? "Marktplatz für Branchen-KI-Pakete — KI-Agenten für jede Branche | AiFekr" : "AI Industry Packs Marketplace — AI Agents for Every Industry | AiFekr";
  const description =
    lang === "fa"
      ? "تیم‌های عامل هوش مصنوعی اختصاصی برای هر صنعت — رستوران، مطب، املاک و بیشتر — دسترسی وابسته به ماژول‌های فعال و اتصال سرویس‌هاست."
      : lang === "de"
        ? "Spezialisierte KI-Agententeams für jede Branche — Restaurant, Praxis, Immobilien, Bau und mehr. Zugriff abhängig von aktiven Modulen und verbundenen Diensten."
        : "Specialized AI agent teams for every industry — restaurants, clinics, real estate, construction and more. Access depends on active modules and connected services.";
  return { title: { absolute: title }, description, alternates: publicAlternates(lang, "/industry"), openGraph: { title, description } };
}

const strings = {
  fa: {
    title: "بازار بسته‌های صنعتی",
    subtitle: "صنعت مناسب را انتخاب کنید؛ فعال‌سازی به اشتراک کسب‌وکار و دسترسی شما بستگی دارد.",
    empty: "بسته‌ای یافت نشد",
    emptySub: "لطفاً با ادمین تماس بگیرید",
    agents: "عامل AI",
    included: "نیازمند CRM فعال",
    view: "مشاهده بسته",
    gold: "طلایی",
    pro: "حرفه‌ای",
  },
  en: {
    title: "Industry AI Packs Marketplace",
    subtitle: "Choose an industry; activation depends on your business subscription and access.",
    empty: "No packs found",
    emptySub: "Please contact admin",
    agents: "AI agents",
    included: "Active CRM required",
    view: "View Pack",
    gold: "Gold",
    pro: "Professional",
  },
  de: {
    title: "Marktplatz für Branchen-KI-Pakete",
    subtitle: "Branche auswählen; Aktivierung abhängig von Business-Abo und Zugriff.",
    empty: "Keine Pakete gefunden",
    emptySub: "Bitte wenden Sie sich an den Administrator",
    agents: "KI-Agenten",
    included: "Aktives CRM erforderlich",
    view: "Paket ansehen",
    gold: "Gold",
    pro: "Professionell",
  },
};

interface Pack {
  id: string; slug: string; name: string; nameEn: string | null; nameDe: string | null; emoji: string;
  tagline: string; taglineEn: string | null; taglineDe: string | null;
  agents: string; tier: string; price: number; color: string;
  gradientFrom: string; gradientTo: string;
}

/** German falls back to English (never Persian) when a pack has no German
 * content yet -- the same convention the rest of the platform uses for a
 * partially-translated row. */
function localized(lang: "fa" | "en" | "de" | "tr", base: string, en: string | null, de: string | null): string {
  if (lang === "de") return de || en || base;
  if ((lang === "en" || lang === "tr")) return en || base;
  return base;
}

export default async function IndustryPage() {
  const lang = await getServerLang();
  const s = lang === "tr" ? { title: "Sektörel yapay zekâ paketleri", subtitle: "Sektör seçin; etkinleştirme işletme aboneliğine ve erişiminize bağlıdır.", empty: "Paket bulunamadı", emptySub: "Güncel bilgi için bize ulaşın", agents: "Yapay zekâ ajanı", included: "Etkin CRM gerekir", view: "Paketi incele", gold: "Altın", pro: "Profesyonel" } : strings[lang];

  let packs: Pack[] = [];
  try {
    packs = await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  } catch {}

  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, "/industry", "CollectionPage")} />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
        </div>

        <section className="mb-10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ background: "linear-gradient(120deg,rgba(249,115,22,.16),rgba(99,102,241,.12))", border: "1px solid rgba(249,115,22,.25)" }}>
          <div className="flex gap-4 items-start"><span className="text-4xl" aria-hidden="true">🎓</span><div><div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "#fb923c" }}>{tri(lang, "آموزش و یادگیری", "EDUCATION & LEARNING", "BILDUNG & LERNEN", "EĞİTİM VE ÖĞRENME")}</div><h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "فضای دانشجویی AIFekr", "AIFekr Student Workspace", "AIFekr-Lernbereich", "AIFekr Öğrenci Alanı")}</h2><p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{tri(lang, "محیطی جدا از ابزارهای بیزنسی برای درس‌ها، جزوه‌های PDF/DOCX، معلم AI، فلش‌کارت، آزمون و تقویم امتحان. برای دانشجوهایی که کسب‌وکار هم دارند، مسیر ارتقای CRM جداگانه در پورتال فراهم است.", "A dedicated learning space for courses, PDF/DOCX materials, a grounded AI tutor, flashcards, quizzes and exam planning—separate from business tools. Students with a business can explore a separate CRM upgrade in the portal.", "Ein eigener Lernbereich für Kurse, PDF/DOCX-Unterlagen, quellenbasierten KI-Tutor, Lernkarten, Tests und Prüfungsplanung – getrennt von Business-Tools. Ein CRM-Upgrade für Studierende mit eigenem Unternehmen ist im Portal separat verfügbar.", "Dersler, PDF/DOCX kaynakları, kaynak temelli AI öğretmeni, kartlar, testler ve sınav planlama için işletme araçlarından ayrı öğrenme alanı. İşletmesi olan öğrenciler portalda CRM yükseltmesini ayrıca inceleyebilir.")}</p></div></div>
          <Link href="/register?student=1" className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: "#ea580c" }}>{tri(lang, "فضای دانشجویی", "Student workspace", "Lernbereich öffnen", "Öğrenci alanı")}</Link>
        </section>

        {packs.length === 0 && (
          <div className="text-center py-20 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>{s.empty}</p>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{s.emptySub}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {packs.map((pack) => {
            let agentCount = 0;
            try { agentCount = JSON.parse(pack.agents).length; } catch {}

            return (
              <div key={pack.id} className="rounded-2xl overflow-hidden flex flex-col transition-all hover:scale-105 hover:shadow-xl"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="p-5 flex items-center gap-3"
                  style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}, ${pack.gradientTo})` }}>
                  <span className="text-3xl">{pack.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white">{localized(lang, pack.name, pack.nameEn, pack.nameDe)}</h3>
                    <p className="text-xs text-white/70">{localized(lang, pack.tagline, pack.taglineEn, pack.taglineDe)}</p>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: pack.tier === "gold" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                        color: pack.tier === "gold" ? "#f59e0b" : "#3b82f6",
                      }}>
                      {pack.tier === "gold" ? s.gold : s.pro}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{agentCount} {s.agents}</span>
                  </div>

                  <div className="flex-1" />

                  <div className="flex items-center justify-between mt-4">
                    <span className="font-bold" style={{ color: pack.color }}>
                      {s.included}
                    </span>
                    <Link href={`/industry/${pack.slug}`}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                      style={{ background: pack.color }}>
                      {s.view}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div></PublicShell>
  );
}
