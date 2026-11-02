# Checkout currency deployment — 2026-11-02

The owner authorized publishing the checkout correction from PR #4.

## Scope

- Persian checkout uses IRT (mapped by the existing order API to IRR for Zarinpal).
- Turkish checkout uses TRY; English and German use USD with the existing bank-payment flow.
- The misleading independent settlement selector was removed. The chat category has a localized label.
- No prices, exchange rates, bank details, credit allocations, schema, or provider settings changed.

## Validation and release

- Eight focused currency/price tests passed; standalone TypeScript checking passed.
- The full suite also passed sequentially on that isolated local database: 1,376 passed, 88 skipped, zero failures across 244 files (235 passed, nine skipped).
- Production webpack build completed successfully in an isolated checkout. Build ID: `Erip4llxf2ZqQ8GHH8hq-`.
- GitHub's build checks passed. Its verify job failed with SQLite timeouts and cascading fixture errors in four files; all 33 tests in those files passed locally, sequentially, on a separate database created from the migration SQL.
- SSH with the existing project key succeeded. Deployment used the existing lock and a verified SQLite backup.
- Preview health and public routes passed before switching; unauthenticated quote POST returned 401.
- Active PM2 `ai-platform`: `/var/www/aifekr-voice-49954a8`, dist `.next-rel-513d7a47`, port 3000. Existing module flags were preserved.
- UI PM2 `aifekr-ui-v2` remains online at `/var/www/aifekr-ui-v2-77a11b6`, port 3048.
- Public `/`, `/login`, `/en`, `/de`, `/tr` returned 200. `/plans` returned the expected guest authentication redirect (307).
- Rollback dist `.next-rel-48a04847` remains available. PM2 state was saved. Free disk space after deployment: approximately 3.8 GB.

## Limits

Browser control in this environment is disabled in Work settings. No post-release authenticated visual or actual quote/order request was performed. The component's quote handler was covered by the focused tests, not live customer settlement. Real payment, entitlement activation, Instagram reconnection, and product credit debit/refund acceptance remain open as documented in the earlier acceptance checkpoint. No new paid-provider request was made during this deployment.
