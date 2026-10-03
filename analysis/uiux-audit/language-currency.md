# Single package currency by language

Release: d397cee. Deployed to https://aifekr.com on 2026-10-04.

- Persian: Toman; Turkish: TRY; English and German: USD.
- Business cards, student offer and authenticated package cards use the same language mapping.
- Removed simultaneous student currency amounts and public currency dropdown. Student reference price converts in the same currency; 80 USD for 90 days and 240 USD reference remain unchanged.
- Bank checkout retains its actual TRY/EUR payment choice and commission notice. No production database changes.

Validation: 8 focused tests passed, TypeScript and targeted ESLint passed, production build succeeded. At 390px mobile width, language-selector transitions and student prices verified locally and on the live domain in all four languages, with no horizontal overflow. Live English student card showed $240.00 crossed out and $80.00; German showed the same USD amounts. Live Persian and Turkish converted both amounts with production FX rates.

Isolated server preview returned HTTP 200 before PM2 switch. Previous release 4239592 preserved for rollback; temporary upload archives and preview removed.
