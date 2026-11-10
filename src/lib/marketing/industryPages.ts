import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { pageJsonLd, pageMetadata, publicAlternates } from "@/lib/seo/site";

/** Industry packs for the public pages: catalogue data only, nothing about the visitor. */
const pick = (lang: Lang, fa: string, en: string | null, de: string | null) => (lang === "de" ? de || en || fa : lang === "en" || lang === "tr" ? en || fa : fa);
function json<T>(lang: Lang, fa: string, en: string | null, de: string | null, fallback: T): T {
  try { return JSON.parse(pick(lang, fa, en, de)) as T; } catch { return fallback; }
}

const LIST_TITLE = { fa: "هوش مصنوعی برای صنایع؛ بسته‌های تخصصی کسب‌وکار", en: "Industry AI packs for business teams", de: "KI-Branchenpakete für Unternehmen", tr: "İşletmeler için sektörel yapay zekâ paketleri" };
const LIST_DESCRIPTION = {
  fa: "بسته‌های AI رستوران، کلینیک، املاک و صنایع دیگر را مقایسه کنید؛ ابزارهای فروش، محتوا و پیگیری مشتری براساس اشتراک و اتصال سرویس‌ها فعال می‌شوند.",
  en: "Compare AI packs for restaurants, clinics, real estate and more. Sales, content and customer tools depend on your subscription and connected services.",
  de: "KI-Pakete für Gastronomie, Praxen, Immobilien und weitere Branchen vergleichen. Vertriebs- und Kundentools hängen von Abo und Verbindungen ab.",
  tr: "Restoran, klinik, emlak ve diğer sektörlerin yapay zekâ paketlerini karşılaştırın. Satış ve müşteri araçları aboneliğe ve hizmet bağlantılarına bağlıdır.",
};

export type IndustryCard = { slug: string; name: string; tagline: string; emoji: string; color: string; from: string; to: string; tier: string; agentCount: number };
export type IndustryDetail = IndustryCard & { valueProposition: string; targetCustomers: string[]; agents: { name: string; description: string; icon: string }[]; painPoints: string[]; outcomes: { metric: string; description: string }[]; kpis: string[] };

type Pack = Awaited<ReturnType<typeof prisma.industryPack.findFirst>> & object;
function card(lang: Lang, p: Pack): IndustryCard {
  let agentCount = 0;
  try { agentCount = JSON.parse(p.agents).length; } catch {}
  return { slug: p.slug, name: pick(lang, p.name, p.nameEn, p.nameDe), tagline: pick(lang, p.tagline, p.taglineEn, p.taglineDe), emoji: p.emoji, color: p.color, from: p.gradientFrom, to: p.gradientTo, tier: p.tier, agentCount };
}

export type IndustryPage = { metadata: Metadata; jsonLd: Record<string, unknown>[]; industries?: IndustryCard[]; industry?: IndustryDetail };

export async function industryPage(lang: Lang, path: string): Promise<IndustryPage | null> {
  if (path === "/industry") {
    const packs = await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
    return { metadata: pageMetadata(lang, "/industry", LIST_TITLE, LIST_DESCRIPTION), jsonLd: pageJsonLd(lang, "/industry", "CollectionPage"), industries: packs.map((p) => card(lang, p)) };
  }
  const [, section, slug, extra] = path.split("/");
  if (section !== "industry" || !slug || extra !== undefined) return null;
  const p = await prisma.industryPack.findUnique({ where: { slug } });
  if (!p?.isActive) return null;
  const base = card(lang, p);
  const description = pick(lang, p.valueProposition, p.valuePropositionEn, p.valuePropositionDe);
  // Same title rule as the classic page: the pack's own name plus the brand.
  const title = lang === "fa" ? `${base.name} — بسته عوامل هوش مصنوعی برای کسب‌وکار شما | AiFekr` : lang === "de" ? `${base.name} — KI-Agenten-Paket für Ihr Unternehmen | AiFekr` : `${base.name} — AI Agent Pack for Your Business | AiFekr`;
  const filler = lang === "fa" ? " ابزارهای تخصصی AI با دسترسی وابسته به اشتراک و تنظیمات شما." : lang === "de" ? " Spezialisierte KI-Tools, abhängig von Abo und Konfiguration." : " Specialist AI tools, subject to your subscription and settings.";
  const snippet = description ? (description.length >= 110 ? description : (description.trim() + filler).slice(0, 160)) : filler.trim();
  return {
    metadata: { title: { absolute: title }, description: snippet, alternates: publicAlternates(lang, `/industry/${slug}`), openGraph: { title, description: snippet } },
    jsonLd: pageJsonLd(lang, `/industry/${slug}`, "WebPage", base.name),
    industry: {
      ...base, valueProposition: description,
      targetCustomers: json<string[]>(lang, p.targetCustomers, p.targetCustomersEn, p.targetCustomersDe, []),
      agents: json<{ name: string; description: string; icon: string }[]>(lang, p.agents, p.agentsEn, p.agentsDe, []).map((a) => ({ name: a.name, description: a.description, icon: a.icon })),
      painPoints: json<string[]>(lang, p.painPoints, p.painPointsEn, p.painPointsDe, []),
      outcomes: json<{ metric: string; description: string }[]>(lang, p.outcomes, p.outcomesEn, p.outcomesDe, []),
      kpis: json<string[]>(lang, p.kpis, p.kpisEn, p.kpisDe, []),
    },
  };
}
