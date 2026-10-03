import type { MetadataRoute } from "next";
import { PRIVATE_PREFIXES, SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // These public forms have noindex metadata. Google must be allowed to
    // crawl them to see that directive; auth-gated workspaces stay disallowed.
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PREFIXES.filter(path => !["/login", "/register"].includes(path)) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
