# AIFekr public SEO audit — 2026-10-04

Scope: 152 unique public sitemap URLs, public redirects, robots, metadata, headings, internal links, language alternates and JSON-LD. No authenticated customer data or paid actions.

Before: all 152 URLs returned HTTP 200, had one H1 and a description, and were indexable. Public JSON-LD parsed successfully; rendered homepage schema was also verified in the browser. Unknown routes returned genuine 404 responses.

Changes: redirect www directly to the apex host while preserving paths and query strings; remove an obsolete Nginx backup from active configurations; give the four audience solutions distinct descriptions and practical workflows in four languages; correct Turkish industry and German content metadata; link Turkish industry detail cards directly to their supported English version; allow crawlers to read the existing noindex directives on login and registration; replace unsupported about-page promises with factual descriptions.

Canonical root URLs with and without the final slash are equivalent. The audit now normalizes URLs and does not misreport this as a defect.

Validation: 23 focused tests passed, TypeScript passed, and ESLint passed for every changed TypeScript file. Repository-wide lint still reports existing errors in unrelated modules. Production build succeeded. Release c197359 is live from /var/www/aifekr-release-c197359, with the previous release retained for rollback and no database migration.

After deployment: all 152 public URLs returned 200, with zero reported canonical, H1, description, indexability, image-alt or JSON-LD parsing defects. No duplicate titles or descriptions and no missing sitemap language-alternate targets remained. HTTP and HTTPS www redirect directly to HTTPS apex with path and query preservation. Unknown pages return 404; login and registration remain noindex. Rendered English solution metadata and schema were verified in the browser. The Persian student solution at a mobile viewport had no horizontal overflow. The isolated preview and production auth endpoint correctly returned 401 to anonymous requests; Open Graph image returned image/png. PM2 state was saved after replacing only ai-platform; the preview was removed.

The first isolated preview bound to 127.0.0.1 caused Next's localized rewrite to lose its language header. Binding it to localhost, consistently with Next's rewrite origin, resolved the preview issue; the full preview crawl and production crawl then passed. No change to application middleware was necessary.

Limits: public checks cannot determine actual Google rankings, clicks, impressions or indexed-page counts. Search-engine query results were inconclusive. PageSpeed API returned quota error 429, so no Core Web Vitals score is claimed. Private Search Console access requires explicit consent and was not performed.

References: [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
