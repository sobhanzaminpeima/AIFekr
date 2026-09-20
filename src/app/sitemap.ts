import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { PUBLIC_PATHS, absoluteUrl } from "@/lib/seo/site";

// Industry packs come from the database, so the sitemap must not be frozen at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = PUBLIC_PATHS.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  try {
    const packs = await prisma.industryPack.findMany({ where: { isActive: true }, select: { slug: true } });
    for (const pack of packs) {
      entries.push({ url: absoluteUrl(`/industry/${pack.slug}`), lastModified: now, changeFrequency: "monthly", priority: 0.6 });
    }
  } catch (e) {
    // A database hiccup must not take the sitemap down; the static pages are still valid.
    console.error("sitemap: could not list industry packs:", e);
  }
  return entries;
}
