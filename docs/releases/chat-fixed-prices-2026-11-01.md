# Owner-approved fixed chat prices

The owner explicitly approved fixed USD/TRY retail prices based on current market rates on 2026-11-01. This resolves the foreign-chat-pricing item in the account/chat/growth release notes.

Reference USD/IRT: 271600 toman per dollar, Alanchand, 2026-11-01. Reference USD/TRY: 49.95587976, XE, latest available snapshot 2026-10-31 17:21 UTC. Each original toman amount was independently converted and rounded half up to cents/kurus. These are fixed retail prices and do not change when reference exchange rates move.

| Package | Toman | USD | TRY |
| --- | ---: | ---: | ---: |
| CHAT_ECO_30 | 199000 | 0.73 | 36.60 |
| CHAT_PLUS_30 | 499000 | 1.84 | 91.78 |
| CHAT_PRO_30 | 1499000 | 5.52 | 275.71 |

Applied with a verified consistent SQLite backup and a transaction touching only these three packages. Existing entitlements and toman terms are preserved; `fixedPrices`, `priceUsd`, `priceTry` and market availability are configured for the same packages. No global exchange-rate record or credit allocation was changed. An explicit system audit entry records the owner's authorization and public pricing sources; no administrator account was impersonated.

Configuration source: `prisma/catalogs/chat-fixed-prices-2026-11-01.json`. Bounded replay tool: `scripts/apply-chat-fixed-prices.cjs --apply` (requires a verified backup; rejects unexpected existing prices). Prices remain manageable through the existing admin package controls.

Validation: 12 real quote requests on a synthetic local account matched fixed amount, currency and toman accounting total for all three packages in four languages. Production public catalog returned the exact expected prices for all 12 combinations. No live payment order, gateway transaction or paid provider call was used for verification. This is a database configuration deployment; the application build and UI build did not need replacement.
