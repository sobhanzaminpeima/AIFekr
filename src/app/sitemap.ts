import { features, solutionCatalog } from "@/lib/marketing/catalog";
import { guides, CONTENT_UPDATED_AT } from "@/lib/marketing/guides";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { PUBLIC_PATHS, absoluteUrl, publicAlternates } from "@/lib/seo/site";
import { PUBLIC_LANGUAGES, localizedPublicPath } from "@/lib/seo/locales";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = new Map(PUBLIC_PATHS.map(page => [page.path, page]));
  for (const path of [...features.map(feature => `/features/${feature.slug}`), ...solutionCatalog.map(solution => `/solutions/${solution.slug}`), ...guides.map(guide => `/guides/${guide.slug}`)]) paths.set(path, { path, changeFrequency: "monthly", priority: 0.7 });
  const entries: MetadataRoute.Sitemap = [];
  for (const page of Array.from(paths.values())) for (const lang of PUBLIC_LANGUAGES) entries.push({ url: absoluteUrl(localizedPublicPath(page.path, lang)), ...(["/", "/pricing"].includes(page.path) || page.path.startsWith("/guides") ? { lastModified: CONTENT_UPDATED_AT } : {}), changeFrequency: page.changeFrequency, priority: page.priority, alternates: { languages: publicAlternates(lang, page.path).languages } });
  try {
    const packs = await prisma.industryPack.findMany({ where: { isActive: true }, select: { slug: true } });
    for (const pack of packs) for (const lang of ["fa", "en", "de"] as const) {
      const path = `/industry/${pack.slug}`;
      // Packs have no reliable modification timestamp; omit lastmod rather than fabricate freshness.
      entries.push({ url: absoluteUrl(localizedPublicPath(path, lang)), changeFrequency: "monthly", priority: 0.6, alternates: { languages: publicAlternates(lang, path).languages } });
    }
  } catch { console.error("sitemap: industry pack lookup unavailable"); }
  return entries;
}
