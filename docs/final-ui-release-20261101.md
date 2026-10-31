# Product-module UI release — 2026-11-01

Application build: `e1251e55`; UI build: `3c9057b` in AIFekr_UI. Commit `bdc4a16b` adds final local verification scripts only. The main branch contains the released application changes.

The final eleven product-module adapters and account profile are connected to existing authenticated APIs. New root routes are independently guarded by `UI_V2_SEO_ENABLED`, `UI_V2_TEAM_ENABLED`, `UI_V2_ORGANIZATION_ENABLED`, `UI_V2_CALL_CENTER_ENABLED`, `UI_V2_ACADEMY_ENABLED`, `UI_V2_OWNER_ENABLED`, `UI_V2_PROFILE_ENABLED` and `UI_V2_FINAL_MODULES_ENABLED`. Detailed migration notes and source inventory live in AIFekr_UI under `docs/activation/`.

Production: PM2 `ai-platform` runs `.next-rel-e1251e55` under `/var/www/aifekr-voice-49954a8`; `aifekr-ui-v2` runs `/var/www/aifekr-ui-v2-3c9057b` on the existing private port. Both are online. Prior pair `.next-rel-d26cdf9` / `/var/www/aifekr-ui-v2-82d459d` is retained. Rollback disables only the newly introduced flags; earlier accounting/social/advisory rollout switches remain enabled.

No schema migration or economic-setting change was needed. A consistent SQLite backup was verified before activation. Current generated Prisma remains isolated in `/var/www/aifekr-prisma-d26cdf9`; the direct and generated external imports in the deployed bundle are verified with `scripts/check-ui-prisma-runtime.cjs` and a read-only database URL.

Verification: 191 selected backend tests passed, 26 skipped; UI has 22 browser-free logic checks. Local HTTP checks covered 49 API/data contracts and 17 rendered pages using synthetic users, plus earlier SEO/team/organization/academy contract batches. Chrome at mobile widths 390 and 320 verified the header menu and CRM drawer closing. Final local browser checks verified authenticated Home and saving account details.

Production checks confirmed 200 for homepage/login, eight referenced static assets, appropriate guest redirects on new protected roots and 401 on unauthenticated APIs. Authenticated production users were not impersonated, and no paid API generation, real payment, external message or phone call was executed for verification.
