import { NextRequest, NextResponse } from "next/server";
import type { Lang } from "@/lib/i18n/server";
import { copy, features, solutionCatalog, text } from "@/lib/marketing/catalog";
import { guides, CONTENT_UPDATED_AT } from "@/lib/marketing/guides";
import { solutionDetails } from "@/lib/marketing/solutionDetails";
import { faqItems } from "@/components/marketing/Sections";
import { getEntryPlans } from "@/lib/marketing/entryPlans";
import { getContactSettings } from "@/lib/marketing/contact";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { publicSeo, standaloneMetadata } from "@/lib/seo/publicSeo";
import { moduleForPath } from "@/lib/growth/attribution";

export const dynamic = "force-dynamic";
const LANGS = ["fa", "en", "de", "tr"] as const;

/**
 * Public content for the new-design pages, localized and read from the same
 * sources as the classic pages (catalog, guides, published packages, credit
 * costs, contact settings, SEO). Contains nothing account-specific.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("lang");
  const lang: Lang = LANGS.includes(raw as Lang) ? (raw as Lang) : "fa";
  const path = (req.nextUrl.searchParams.get("path") || "/").slice(0, 200);
  const [plans, contact, costs] = await Promise.all([getEntryPlans(lang).catch(() => []), getContactSettings(lang), getCreditCosts()]);
  const seo = publicSeo(lang, path);
  const body = {
    lang,
    seo: seo && { metadata: standaloneMetadata(lang, seo.metadata), jsonLd: seo.jsonLd },
    growthModule: moduleForPath(path),
    copy: { hero: text(lang, copy.hero), intro: text(lang, copy.intro), noPromise: text(lang, copy.noPromise), credits: text(lang, copy.credits), creditsDesc: text(lang, copy.creditsDesc) },
    plans,
    features: features.map(f => ({ slug: f.slug, route: f.route, category: f.category, title: text(lang, f.title), desc: text(lang, f.desc), items: f.items.map(i => text(lang, i)), requirement: text(lang, f.requirement) })),
    solutions: solutionCatalog.map(s => ({ slug: s.slug, title: text(lang, s.title), modules: s.modules, description: text(lang, solutionDetails[s.slug].description), guide: solutionDetails[s.slug].guide, steps: solutionDetails[s.slug].steps.map(step => ({ title: text(lang, step.title), body: text(lang, step.body) })) })),
    guides: guides.map(g => ({ slug: g.slug, title: text(lang, g.title), description: text(lang, g.description), related: g.related, sections: g.sections.map(sec => ({ title: text(lang, sec.title), body: text(lang, sec.body) })) })),
    guidesUpdatedAt: CONTENT_UPDATED_AT,
    faq: faqItems.map(f => ({ q: text(lang, f.q), a: text(lang, f.a) })),
    costs: { imageStandard: costs.image_standard, imageHd: costs.image_hd, video5s: costs.video_5s, video10s: costs.video_10s },
    contact: { email: contact.contact_email, phone: contact.contact_phone, address: contact.contact_address, telegram: contact.contact_telegram },
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } });
}
