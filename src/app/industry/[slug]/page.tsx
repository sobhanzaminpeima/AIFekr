import PublicShell from "@/components/marketing/PublicShell";
import { notFound } from "next/navigation";
import { publicAlternates, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { cookies } from "next/headers";
import Link from "@/components/marketing/PublicLink";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import ActivateButton from "@/components/industry/ActivateButton";

export const dynamic = "force-dynamic";

// Each pack gets its own title/description (was previously unreachable by
// Google at all — this route lived under the auth-gated (dashboard) group,
// which redirected every logged-out visitor, including crawlers, to
// /login). Title includes both the pack name and "AiFekr" so the page can
// rank for the pack's own keywords ("هوش مصنوعی برای رستوران") and for
// brand-name searches.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const pack = await prisma.industryPack.findUnique({ where: { slug: params.slug } });
  if (!pack?.isActive) notFound();
  const lang = await getServerLang();
  const name = lang === "de" ? (pack.nameDe || pack.nameEn || pack.name) : (lang === "en" || lang === "tr") ? (pack.nameEn || pack.name) : pack.name;
  const description = lang === "de" ? (pack.valuePropositionDe || pack.valuePropositionEn || pack.valueProposition) : (lang === "en" || lang === "tr") ? (pack.valuePropositionEn || pack.valueProposition) : pack.valueProposition;
  const title = lang === "fa" ? `${name} — بسته عوامل هوش مصنوعی برای کسب‌وکار شما | AiFekr` : lang === "de" ? `${name} — KI-Agenten-Paket für Ihr Unternehmen | AiFekr` : `${name} — AI Agent Pack for Your Business | AiFekr`;
  const filler = lang === "fa" ? " ابزارهای تخصصی AI با دسترسی وابسته به اشتراک و تنظیمات شما." : lang === "de" ? " Spezialisierte KI-Tools, abhängig von Abo und Konfiguration." : " Specialist AI tools, subject to subscription and configuration.";
  const snippet = description ? (description.length >= 110 ? description : (description.trim() + filler).slice(0, 160)) : filler.trim();
  return {
    title: { absolute: title },
    description: snippet,
    alternates: publicAlternates(lang, `/industry/${params.slug}`),
    openGraph: { title, description: snippet },
  };
}

const strings = {
  fa: {
    agents: "عوامل هوش مصنوعی", agent: "عامل", painPoints: "مشکلاتی که حل می‌کند",
    outcomes: "نتایج بالقوه", kpis: "شاخص‌های کلیدی داشبورد", included: "همراه اشتراک AiFekr",
    activate: "فعال‌سازی بسته", loginToActivate: "برای فعال‌سازی وارد شوید",
    back: "← بازگشت به همه بسته‌ها", gold: "طلایی", pro: "حرفه‌ای",
    registerFirst: "ثبت‌نام و فعال‌سازی", alreadyActive: "بسته شما فعال است",
    goToBusiness: "رفتن به داشبورد کسب‌وکار",
  },
  en: {
    agents: "AI Agents", agent: "agents", painPoints: "Problems It Solves",
    outcomes: "Potential outcomes", kpis: "Dashboard KPIs", included: "Included with your AiFekr subscription",
    activate: "Activate Pack", loginToActivate: "Login to Activate",
    back: "← Back to All Packs", gold: "Gold", pro: "Professional",
    registerFirst: "Register & Activate", alreadyActive: "Your pack is active",
    goToBusiness: "Go to Business Dashboard",
  },
  de: {
    agents: "KI-Agenten", agent: "Agenten", painPoints: "Probleme, die es löst",
    outcomes: "Mögliche Ergebnisse", kpis: "Dashboard-KPIs", included: "In Ihrem AiFekr-Abo enthalten",
    activate: "Paket aktivieren", loginToActivate: "Zum Aktivieren anmelden",
    back: "← Zurück zu allen Paketen", gold: "Gold", pro: "Professionell",
    registerFirst: "Registrieren & aktivieren", alreadyActive: "Ihr Paket ist aktiv",
    goToBusiness: "Zum Business-Dashboard",
  },
};

export default async function PackDetailPage({ params }: { params: { slug: string } }) {
  const pack = await prisma.industryPack.findUnique({ where: { slug: params.slug } });
  if (!pack?.isActive) notFound();

  const lang = await getServerLang();
  const s = lang === "tr" ? { agents: "Yapay zekâ ajanları", agent: "ajan", painPoints: "Ele alınan sorunlar", outcomes: "Olası sonuçlar", kpis: "Panel göstergeleri", included: "Etkin CRM aboneliğine dahil", activate: "Paketi etkinleştir", loginToActivate: "Etkinleştirmek için giriş yap", back: "Tüm paketlere dön", gold: "Altın", pro: "Profesyonel", registerFirst: "Kaydol ve etkinleştir", alreadyActive: "Paketiniz etkin", goToBusiness: "İşletme paneline git" } : strings[lang];

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let userId: string | null = null;
  let userPackId: string | null = null;
  let hasBusinessSubscription = false;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      userId = payload.userId;
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { industryPackId: true, crmPlan: true, crmPlanExpiry: true } });
      userPackId = u?.industryPackId || null;
      hasBusinessSubscription = !!u && u.crmPlan !== "NONE" && (!u.crmPlanExpiry || u.crmPlanExpiry.getTime() > Date.now());
    }
  }

  const isCurrentPack = userPackId === pack.id;

  // German falls back to English (never Persian) when a pack has no German
  // content yet -- same convention as industry/page.tsx's `localized()`.
  function pick(fa: string, en: string | null, de: string | null): string {
    if (lang === "de") return de || en || fa;
    if ((lang === "en" || lang === "tr")) return en || fa;
    return fa;
  }
  function parseJson<T>(fa: string, en: string | null, de: string | null, fallback: T): T {
    try { return JSON.parse(pick(fa, en, de)); } catch { return fallback; }
  }

  const agents = parseJson<{ name: string; role: string; description: string; icon: string }[]>(pack.agents, pack.agentsEn, pack.agentsDe, []);
  const outcomes = parseJson<{ metric: string; description: string }[]>(pack.outcomes, pack.outcomesEn, pack.outcomesDe, []);
  const painPoints = parseJson<string[]>(pack.painPoints, pack.painPointsEn, pack.painPointsDe, []);
  const kpis = parseJson<string[]>(pack.kpis, pack.kpisEn, pack.kpisDe, []);
  const targetCustomers = parseJson<string[]>(pack.targetCustomers, pack.targetCustomersEn, pack.targetCustomersDe, []);
  const name = pick(pack.name, pack.nameEn, pack.nameDe);
  const tagline = pick(pack.tagline, pack.taglineEn, pack.taglineDe);
  const valueProposition = pick(pack.valueProposition, pack.valuePropositionEn, pack.valuePropositionDe);

  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, `/industry/${params.slug}`, "WebPage", name)} />
      {/* Hero */}
      <div className="p-8 md:p-12" style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}, ${pack.gradientTo})` }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-5xl">{pack.emoji}</span>
            <div>
              <h1 className="text-3xl font-bold text-white">{name}</h1>
              <p className="text-white/80 mt-1">{tagline}</p>
            </div>
          </div>
          <p className="text-white/90 text-lg max-w-2xl">{valueProposition}</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {targetCustomers.map((c) => (
              <span key={c} className="px-3 py-1 rounded-full text-sm bg-white/20 text-white">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left */}
        <div className="lg:col-span-2 space-y-8">
          {/* Agents */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
              {s.agents} ({agents.length} {s.agent})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div key={agent.name} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <span className="text-2xl flex-shrink-0">{agent.icon}</span>
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{agent.name}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{agent.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {painPoints.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{s.painPoints}</h2>
              <ul className="space-y-2">
                {painPoints.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="text-red-400 mt-0.5">✕</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {outcomes.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>{s.outcomes}</h2>
              <div className="grid grid-cols-2 gap-4">
                {outcomes.map((o) => (
                  <div key={o.metric} className="p-4 rounded-xl" style={{ background: `${pack.color}15`, border: `1px solid ${pack.color}33` }}>
                    <p className="font-bold text-lg" style={{ color: pack.color }}>{o.metric}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{o.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: pricing */}
        <div className="space-y-6">
          <div className="rounded-2xl p-6 text-center sticky top-6" style={{ background: "var(--surface-1)", border: `2px solid ${pack.color}44` }}>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
              style={{
                background: pack.tier === "gold" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                color: pack.tier === "gold" ? "#f59e0b" : "#3b82f6",
              }}>
              {pack.tier === "gold" ? s.gold : s.pro}
            </span>
            <div className="text-lg font-bold mb-1" style={{ color: pack.color }}>{hasBusinessSubscription ? s.included : tri(lang, "نیازمند اشتراک کسب‌وکار", "Business subscription required", "Business-Abo erforderlich", "İşletme aboneliği gerekli")}</div>
            <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {hasBusinessSubscription
                ? tri(lang, "پس از خرید اشتراک CRM، انتخاب صنعت هزینه جداگانه ندارد.", "Once CRM is active, selecting an industry has no separate charge.", "Mit aktivem CRM-Abo kostet die Branchenwahl nichts extra.", "CRM etkin olduktan sonra sektör seçimi için ek ücret alınmaz.")
                : tri(lang, "ابتدا پلن CRM را تهیه کن؛ سپس بستهٔ صنعت و ابزارهای مرتبط در پورتال فعال می‌شوند.", "Choose a CRM plan first; then this industry pack and its related tools can be activated in your portal.", "Wähle zuerst einen CRM-Tarif; danach kannst du dieses Branchenpaket im Portal aktivieren.", "Önce CRM planı satın al; ardından bu sektör paketini portalında etkinleştir.")}
            </div>

            {isCurrentPack ? (
              <div>
                <div className="mb-3 text-sm font-medium py-2 rounded-xl" style={{ background: `${pack.color}20`, color: pack.color }}>
                  ✓ {s.alreadyActive}
                </div>
                <Link href="/business-doctor"
                  className="block w-full py-3 rounded-xl font-semibold text-white text-center"
                  style={{ background: pack.color }}>
                  {s.goToBusiness}
                </Link>
              </div>
            ) : userId && hasBusinessSubscription ? (
              <ActivateButton slug={pack.slug} color={pack.color} label={s.activate} />
            ) : userId ? (
              <Link href="/crm" className="block w-full py-3 rounded-xl font-semibold text-white text-center" style={{ background: pack.color }}>
                {tri(lang, "مشاهده پلن‌های کسب‌وکار", "View business plans", "Business-Tarife ansehen", "İşletme planlarını gör")}
              </Link>
            ) : (
              <>
                <Link href={`/register?pack=${pack.slug}`}
                  className="block w-full py-3 rounded-xl font-semibold text-white text-center mb-2"
                  style={{ background: pack.color }}>
                  {s.registerFirst}
                </Link>
                <Link href="/login" className="block text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  {s.loginToActivate}
                </Link>
              </>
            )}
          </div>

          {kpis.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{s.kpis}</h3>
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <div key={kpi} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: pack.color }}>▪</span>{kpi}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href="/industry" className="block text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>
            {s.back}
          </Link>
        </div>
      </div>
    </div></PublicShell>
  );
}
