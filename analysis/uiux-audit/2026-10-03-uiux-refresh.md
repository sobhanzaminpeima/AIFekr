# UI/UX refresh — 2026-10-03

## Changes

- Compact public pricing and workspace plans, grouped business/student offerings, shared 1/3/6-month selector. Existing 5% quarterly and 10% semiannual discounts are shown beside each term. Full feature lists remain available through disclosures.
- Checkout now presents a bank-card visual with grouped, selectable IBAN, account holder and copy button; exact amount, term, transfer reference, upload requirements, and approval status have distinct hierarchy.
- Bank orders match the requested buyer, period, currency and amount before reusing a pending order. Regular student subscriptions support 1/3/6 months; the existing introductory 60-day offer remains a separate fixed offer. Credit purchases remain one-time purchases. Annual API compatibility remains for existing clients, but the purchase selectors show only the requested terms.
- Shared workspace surfaces, focus visibility, mobile navigation/search, desktop breadcrumbs, loading/error fallback, keyboard search, accessible control names, theme controls and responsive admin navigation were improved.
- Fixed actual mobile overflow in the student workspace and CEO advisor. CEO sample questions remain accessible in a disclosure on mobile.

## Review scope and evidence

The accompanying route inventory enumerates all page sources; loading/error/empty flags are static heuristics, not proof that every runtime state works. Browser review used an isolated SQLite database with synthetic users, packages and bank orders, never the original application database.

Reviewed visually or through rendered DOM at mobile width: home, chat, plans, credits, settings, checkout, CRM, sales, social, SEO/sites/pipeline, voice agent, business doctor, CEO/orchestrator, meeting, lead generation, website designer, accounting dashboard and all eight accounting subpages, student workspace and all eight tabs, image/video/music generation, agents, industry packs, referral, both galleries, startup builder/contact, organization onboarding, all six tools and seven assistant routes. All static admin pages were visited, including financial, subscriptions, users, packages, models, module access, usage, dashboard, admins, affiliate, analytics, categories, chats, companies, credit tiers, CRM, generated websites, industry packs, invites/manage, lead connectors, LLM, logs, prompts, provider fallback, public share, revenue, settings, startup inquiries, student, system, tools and voice agent.

Critical pricing/checkout were also checked at desktop width and public pricing at tablet width. Dark mobile checkout and light desktop plans were visually checked. Student tabs and the later production route batches reported no main-content horizontal overflow at 390 px. Mobile drawer opening/closing and search filtering/Enter navigation were exercised. IBAN clipboard content was verified against the synthetic order. Placeholder routes `/accounting/invoices` and `/admin/payments` do not exist; the valid pages are accounting/CRM and `/admin/financial`. `/create` redirects to chat as designed.

No paid AI generation, external publication, real bank payment, real receipt upload, destructive admin action or third-party connection was exercised. Dynamic detail routes require representative production records and were reviewed in source rather than certifying each real record. Full WCAG compliance and every possible integration state are not claimed.

## Validation

- TypeScript: `npx tsc --noEmit` passed.
- Payment period, bank presentation, subscription term, payment-create API and student-offer suites: 25 tests passed across five files.
- ESLint passed for the new billing/navigation/layout/payment components and selected changed shared components. Wider changed-file lint still reports existing unused variables, explicit-any errors and hook warnings in legacy pages; the duplicate label introduced during this work was corrected.
- Production build succeeded, generating 109 static pages. The repository's existing build configuration skips lint/type checks, so the separate checks above matter.
- `git diff --check` passed.
- No schema migration; authentication, RBAC and buyer-scoped payment reads remain server-side.

## Reviewer assessment

These are qualitative design scores for the reviewed flows, not user-research measurements.

| Category | Score / 5 | Reason / remaining limit |
| --- | --- | --- |
| Navigation clarity | 4 | Search covers all main destinations; breadcrumbs and mobile drawer provide wayfinding. Some legacy destinations still redirect. |
| Beginner comprehensibility | 4 | Exact amount and bank-review steps are explicit; some advanced admin/BI pages retain technical language. |
| Accessibility | 3.5 | Visible focus, native dialogs, keyboard search and many named fields; legacy unnamed icon controls and full contrast/screen-reader audit remain. |
| Visual consistency | 4 | Shared surfaces and compact billing; complex legacy module layouts remain individual. |
| Workflow efficiency | 4 | One selector, one plan CTA, one receipt selection and one upload action; bank transfer and admin approval are required external steps. |

Restaurant-owner / office-manager review: bank amount and reference should be unmistakable; approval is never implied by uploading a receipt. First-time AI user review: feature details are optional instead of overwhelming the comparison. Older-user review: readable labels, visible focus, 44 px primary actions and mobile IBAN avoid tightly packed interactions. Additional user testing is still appropriate.

## Integration and follow-up limits

JARVIS classification: pricing, navigation and bank checkout are browser-safe. Existing browser routes and payment endpoints remain available for explanation/navigation. New remote JARVIS tools were not introduced; receipt selection still requires the user's file. No desktop-only action was added.

The business-impact skill path referenced by the repository does not exist in this checkout; no automated simulation was run. The change serves the requested reduction in comparison friction and clearer transfer instructions. A follow-up production QA pass should cover authenticated user roles, real bank settings, upload/review/rejection lifecycle and connected external providers. The isolated preview intentionally uses TEST ONLY bank details.
