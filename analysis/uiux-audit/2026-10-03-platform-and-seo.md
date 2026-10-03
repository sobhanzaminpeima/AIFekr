# Platform, packages and SEO review — 2026-10-03

Local implementation only. This supplements the initial UI review in `2026-10-03-uiux-refresh.md`; no production deployment or GitHub push was performed.

## Delivered

- Compact landing/pricing package groups: AI team, CRM and student; monthly, quarterly and semiannual terms. Currency and duration remain selected when switching groups. Totals use the same USD basis and term discounts as checkout. TRY/EUR reference conversions disclose fallback rates; final orders snapshot their amounts.
- The existing first-time student offer remains a clearly separate fixed 60-day offer. Regular student subscriptions support 1/3/6 months. This preserves the established entitlement rule.
- Shared bank-account defaults now explicitly use the supplied TRY and EUR IBANs and Mehrad moharramzadeh. Both normalize to 26 characters and pass mod-97 checksum. Existing administrator settings and historical payment snapshots retain precedence. The Euro notice explains commission-free transfer from a Euro account at Ziraat to the Ziraat recipient, and asks customers of other banks to check their transfer fees.
- Modern checkout card with IBAN/holder/reference copying, order totals, term, receipt validation, and explicit pending/approved/rejected states.
- Shared navigation, search, keyboard/dialog behavior, responsive spacing, focus states, accessible form labels and module start guides with related destinations. Existing module tools remain available.
- Business Doctor, lead generation, sales and website history now check HTTP responses and expose actionable errors. Voice list loaders terminate loading on failure and show retry instead of a misleading subscription upsell. Legacy voice/CRM payment calls without an explicit term default to monthly; invalid explicit terms remain rejected.
- Public routes have stable URL-selected language independent of preference cookies: Persian base routes and /en, /de, /tr. Internal public links, language switching, canonical and reciprocal hreflang reflect those URLs. /fa aliases redirect to the base route. Industry detail records lack Turkish content, so Turkish aliases redirect to English and are omitted from Turkish hreflang/sitemaps.
- Public metadata/social images, private noindex metadata, sitemap deduplication and language alternates, active industry records only, reliable content modification dates. No invented per-request lastmod timestamps.
- Three practical guides in four languages for CRM follow-up, SEO content workflow and student planning; SSR article content, headings, table of contents, useful related links, Article and BreadcrumbList structured data. Homepage/feature/resource links surface them. MotionReveal no longer hides initial content behind client animation or requires Framer Motion itself.

## Verification

- Production build passed (110 generated static pages). Build configuration skips lint/types, so separate checks were run.
- TypeScript passed. Targeted ESLint passed for the new SEO/navigation/marketing helpers and selected technical module changes; legacy lint findings elsewhere remain described in the earlier review.
- 33 tests passed in seven suites: billing periods, subscription entitlements, checkout presentation, API purchase authentication/order matching/monthly compatibility, special student offer, locale URLs and HTTP error handling.
- Browser: landing and pricing in Persian/English/German, Turkish guide index, English/Persian guide details, unique titles, document language, canonical and five alternate links. Rendered JSON-LD was inspected and parsed: WebPage, BreadcrumbList and Article with localized URLs and real content dates.
- Browser interaction: 6-month Team prices and EUR links updated correctly. Switching to student revealed the reset issue; the implementation was then changed to shared selection state and rechecked in the final build.
- At 390 px, every user-listed main destination was visited: home/chat/student/Business Doctor/CRM/sales/voice/industry/social/leads/SEO/web designer/accounting/CEO/meeting/agents/gallery/startup, plus plans and checkout. No application-render error or document horizontal overflow was observed. The earlier review includes broader module tabs, tools, assistants and admin routes.
- Final sitemap HTTP/XML check: 131 URLs, 131 unique, zero wrong-host URLs and zero private dashboard/auth URLs. robots.txt points to https://aifekr.com/sitemap.xml.
- Synthetic account and isolated `uiux-preview.db`; no real AI generation, external publishing, bank transfer, email invitation, destructive admin action or production database migration.
- Rapid sequential route review can exceed the existing API rate-limit bucket and show a retry state; this is not evidence of an empty workspace. Final voice retry was checked after restarting the isolated preview.

## SEO assessment and remaining measurement

Qualitative code/preview review scores, not Lighthouse metrics, user research or search ranking predictions:

| Area | Score / 5 | Evidence and limit |
| --- | --- | --- |
| Crawl/index configuration | 4 | Public-only sitemap and private robots metadata; verify deployed HTTP responses and Search Console coverage after release. |
| International SEO | 4 | Stable URLs and reciprocal alternates; DB package descriptions outside Persian still use administrator English copy. |
| On-page/content | 4 | Unique metadata and three useful multilingual guides; expand original examples from real product/customer evidence over time. |
| Navigation/accessibility | 4 | Responsive shared shell and related guidance; full keyboard/screen-reader/contrast audit remains. |
| Performance | 3.5 | Production build and visible SSR content; no field Core Web Vitals or Lighthouse score claimed. |

Deployment must set `NEXT_PUBLIC_APP_URL=https://aifekr.com` before building. The local .env originally points to port 3003; the final verification build overrides this value without changing the user's environment file. Submit the deployed sitemap in Search Console and measure indexing, engagement and field Core Web Vitals there; account access was not supplied. No ranking guarantee is implied.

Dynamic detail records, real third-party integrations, all purchase/approval states and every advanced admin action require representative staging/production data. The initial review lists precisely what was exercised. This is not a complete security penetration test or WCAG certification.

## Primary SEO guidance

- [Google: localized versions and hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: building a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
