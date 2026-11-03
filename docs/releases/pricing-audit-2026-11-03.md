# Independent pricing audit after the pricing sync release — 2026-11-03

Scope: prices, categories and packages across admin, landing, platform and checkout; languages and currencies; cache; release safety. Started from production backend `.next-rel-79adcbf7` and UI `093870fc` (both matched the release report).

## Problems found (with evidence)

1. **`/plans` showed packages in the wrong currency.** `DynamicPlans` priced on the client and fell back to the package's base currency.
   - `VF_CREATOR_5` has a Toman price only, so English, German and Turkish visitors saw "4,250,000 Toman", and their USD/TRY quote then fails.
   - The landing omits it for those languages. A regression test reproduced the bug before the fix.
2. **The Video Factory package list (new design, `/api/video-factory/catalog`) had the same flaw, in both directions.**
   - Toman-based packages were shown in Toman to every language.
   - USD-based packages were shown in dollars to Persian visitors, while the landing shows 18,337,380 Toman.
   - A struck-out "0 Toman" appeared when there was no before-discount price.
   - The API also returned hidden packages; drafts were only filtered on the client.
3. **The order route didn't refuse hidden or retired offers on its own.** It relied on the quote. No live package was exploitable, because every published package has terms and therefore needs a quote, but a package without terms could have bypassed the check.
4. **Release cleanup could have taken the live new design down.**
   - New-design releases link `node_modules` to the previous release, so the live UI depended on a chain: `093870fc → c7a89831 → ce742a7a → 77a11b6`.
   - `prune-releases.sh` keeps only the live and previous folders, so it would have deleted the middle and end of the chain.
   - Free disk was 3.0 GB, the minimum the release check accepts.

## Fixes

- **One server resolver** (`resolveOffer` in `lib/marketing/entryPlans.ts`) now prices every term for the visitor's currency. It uses the fixed price, or a conversion with an approved rate; otherwise the term is not offered. The landing, `/api/packages` (now with `offers` per term) and the Video Factory catalog all use it. `/plans` and the new design show only these offers, including the admin's before-discount price.
- **The order route** refuses hidden and retired offers even without a quote.
- **`prune-releases.sh`** now keeps every folder a kept release links into, one hop at a time, and has a `--dry-run` mode. Two dry runs caught my own first two attempts before anything was removed. The real run freed space from 3.0 to 5.5 GB; the live chain was untouched and confirmed healthy. The old script is kept as `prune-releases.sh.bak-20261103`.
- **The new release's UI package contains its own `node_modules`**, so it no longer depends on any link chain.

## Tests

- Backend: 1,402 tests passed, 0 failed, including new regression tests for the wrong-currency cases, the Video Factory catalog, and hidden/retired orders.
- TypeScript: both projects clean. ESLint: no errors on the changed files.
- Production builds: both projects.
- Preview checks before the switch:
  - In English, `/api/packages` has only USD offers and no `VF_CREATOR_5`.
  - In Persian, `VF_CREATOR_5` is 4,250,000 IRT with 7,000,000 before discount, and every offer is IRT.
  - The admin API returns 401.
- After the switch, for all four languages:
  - Landing and `/plans` offers are identical (count and amount).
  - No offer is in another currency.
  - Admin package API returns 401 for GET, POST, PUT and DELETE.
  - The database is connected; the public pages and the new design return 200.
  - Chat prices are unchanged: 199,000 / 499,000 / 1,499,000.

## Not tested or needs the owner

- No real payment and no signed-in production walkthrough of `/plans` or the admin preview were done.
- No visual check of the changed Video Factory package view on mobile.
- **`VF_CREATOR_5` has no USD/TRY price.** Approved Toman and lira rates are expired and XE sync is not configured, so it stays Persian-only. No price or rate was set.
- During the switch, while preview and production both ran, a few analytics writes (growth events) hit SQLite lock timeouts at 13:51 UTC. Nothing was logged after the switch.

## Release

- Backend `97c5cf8a` (GitHub `main`, branch `claude/pricing-audit-20261103`) runs as `.next-rel-97c5cf8a`.
- UI `34ac178` (local branch `claude/ui-pricing-audit-20261103`; the UI repository has no remote) runs as `/var/www/aifekr-ui-v2-34ac178`.
- Rollback pair kept: `.next-rel-79adcbf7` and `aifekr-ui-v2-093870fc` with its chain.
