# Platform audit — 2026-11-01

Verdict: broad automated and HTTP validation passed after two test corrections. This is not a certification of defect-free behavior. Real-device/browser interaction and external production transactions remain unverified.

## Evidence

- Main backend suite: 243 files, 1459 tests; original run 1370 passed, 88 skipped, one failed. The failure was the read-only `student/workspace` provider-list import being classified as a model call. Its explicit read-only classification was added; both coverage tests then passed. No billing behavior changed.
- Opt-in database integrations: 89 tests across seven files passed with synthetic users and mocked external services. They cover bank-payment settlement, duplicate approval, referral commissions, student activation, course generation/learning, voice webhook billing and registration access. A stale assertion expected the referrer's entire balance to be one purchase's commission after another test had already awarded commission. It now checks the balance delta and still verifies one ledger entry for the payment. No real bank transfer, external call or model generation was performed.
- UI logic suite: 25 tests passed. UI production build `77a11b6` and its TypeScript validation passed.
- Authenticated local SSR: 85 platform and admin pages returned 200 without the application's error boundary, using a synthetic local super-admin. This verifies server rendering and routing, not hydrated controls or visual layout.
- Local account workflow smoke passed: profile, wallet, credits, notifications, project move, original-preserving edit branch, mark-read persistence, full growth JSON and CSV. Four account pages rendered for all four locales.
- Production crawl covered 168 sitemap URLs. Initial fast crawl encountered six transient 500s: UI logs showed upstream public-content 429s when the request rate exceeded the API budget. All six returned 200 on direct recheck. A paced crawl had one timeout at `/en/terms`; its recheck overlapped the UI deployment restart and hit an upstream ECONNREFUSED. The page and content API returned 200 once the new process was ready. Do not describe these as a clean first-pass crawl or as proof that 429s cannot cause page errors.
- Production checks after deployment: root/login/pricing/choose-plan 200; private account/admin routes redirect guests to login; private APIs return 401/403. All four localized catalogs contain Business, Student, Fitness and the three paid Chat packages with the proper currency. Both PM2 services are online.

## App correction

The new UI memoizes public `siteData(path)` per server render through React `cache`, sharing the read between metadata generation and page rendering. This reduces duplicate upstream content requests. It does not remove or weaken rate limits, change pricing, grant access, or claim unlimited crawler capacity.

Current UI runtime: `/var/www/aifekr-ui-v2-77a11b6`. Previous `/var/www/aifekr-ui-v2-f75d4cb` is retained. Backend app build remains `.next-rel-48a04847` in `/var/www/aifekr-voice-49954a8`; backend changes in this audit are test corrections and documentation only. Fixed chat-price configuration from the previous release remains applied.

## Unverified acceptance checks

1. Hydrated browser interaction, mobile breakpoints, keyboard focus and visual light/dark review. Browser control was disabled in Work settings during the prior attempted review; no bypass was used.
2. A real Zarinpal payment through callback, settlement and entitlement activation; a real IBAN transfer and receipt approval. Local transaction tests do not prove external gateway availability.
3. Real Instagram disconnect/reconnect to another account and publishing approval flow.
4. Paid production generation for every configured image/video/voice/text provider, including interruption and refunds. No paid-provider tests were newly authorized for this audit.
5. Native iOS/Android installation and app-switch receipt recovery on real devices.
6. Render/native/network tests still conditionally skipped where FFmpeg/Remotion dependencies or explicit public-network flags are absent. Enabled database integrations passed, but the original full-suite skip count must not be presented as all executed.

No production account was impersonated, no production user data was edited for testing, and no rate, limit, credit allocation or new paid test was introduced. Current evidence supports the checked contracts; it does not support “the entire platform has no defects.”
