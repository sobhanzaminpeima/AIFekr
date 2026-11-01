# Account, chat, growth reporting and checkout release

Production backend build `48a04847`, UI build `ad8a44d`. Both PM2 services are online. Backend source is pushed to `main` and `codex/accounting-live-ui`; UI source is pushed to `codex/first-success-media` in AIFekr_UI.

## User-facing changes

- Plain-text user turns can be edited into a new conversation branch. The original thread stays intact. Context before the edited turn is copied, executable actions and routing state are not. The edited draft opens in the new composer; sending it is a separate, normally billed action. File/media turns retain their existing behavior.
- Conversations can move to an owned project or out of it. Project contents are accessible from the sidebar; every project is listed. Both the project and conversation ownership are checked in the same transaction. Project conversation counts also exclude other owners.
- `/settings` uses a clearer account header and grouped real profile, security, appearance and connection forms.
- `/wallet` separates referral earnings from AI credits. `/credits` uses the new credit wallet, actual usage, purchases, tiers and current payment currency. `/notifications` offers all/unread filters and server-confirmed read actions.
- Existing administration pages keep their working backend controls inside a unified frame, persistent header, mobile drawer, readable typography and dashboard quick links.
- Customer Growth Center has an export panel: UTF-8 CSV for spreadsheets and JSON containing cohort funnel, campaigns and customer snapshots. CSV includes payment totals, active days, credit use and module-success counts. Exports are SUPER_ADMIN-only, audited and no-store. They exclude users' CRM contacts and chat/generated content. Current customer states are explicitly distinguished from the selected funnel date range. Complete export uses one customer evaluation rather than recomputing it for every 50-row page; oversized exports fail instead of silently truncating.
- Package checkout shows a server quote, final amount and payment method before creating a payment order. The exact selected fitness plan now reaches checkout. Missing fitness onboarding has an explicit profile link and a return link to the same package. Chat package feature differences are visible.

## Validation and limits

- Both production builds and TypeScript checks passed. Changed backend files passed lint with zero errors (five existing/conventional warnings).
- 32 selected backend tests and 25 UI logic tests passed.
- Synthetic local account: seven pages rendered, four account pages returned 200 in all four locales; profile, wallet, notifications, credit tiers and usage APIs passed. Branch creation preserved the original, project move persisted, mark-read persisted, JSON and CSV downloaded correctly.
- Local published test package: displayed price matched quote in IRT/TRY/USD for all four locales. Quote preparation created no payment order. No real payment, payout, generation or provider spend was performed.
- Browser automation was disabled by Work settings during this review. Visual screenshots, client interaction and actual device checks were therefore not completed in this release; HTTP/SSR/API and logic tests were used.
- Production: public pages 200, protected account/admin pages redirect to login, private APIs return 401/403 to guests; no production account was impersonated. Verified DB backup and exact Prisma runtime guard passed. Previous app builds are retained; module flags remain enabled. No schema, tariff, credit-policy or user-data changes.

## Pricing configuration still needing owner input

Production CHAT_ECO_30, CHAT_PLUS_30 and CHAT_PRO_30 have only IRT prices (199000, 499000, 1499000). Their foreign-currency conversion cannot be offered with the expired approved rates. Consequently, paid chat plans currently appear in Persian only; Business, Student and Fitness appear in all four languages. Owner approval of fixed USD/TRY prices or a current free-market rate is required before publishing those foreign chat prices. No rate or package price was invented or changed in this release.

Runtime: `/var/www/aifekr-voice-49954a8/.next-rel-48a04847`, `/var/www/aifekr-ui-v2-ad8a44d`. Rollback: `.next-rel-a8fb73e0`, `/var/www/aifekr-ui-v2-2914b24`.
