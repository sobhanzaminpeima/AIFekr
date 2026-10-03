# Student offer — 2026-10-04

New student welcome offer: 3 months (90 days), total USD 80, with the regular three-month USD 240 reference price struck through. Shared landing and pricing cards display USD clearly with local-currency equivalents. The student tab shows the same offer directly, and the purchase page places it first with a fixed term instead of unrelated billing-period controls.

New purchases use STUDENT_FIRST_THREE_MONTHS. Legacy STUDENT_FIRST_TWO_MONTHS orders keep their existing terms and bank-payment entitlement snapshots; they are not rewritten. Existing first-purchase eligibility remains. Package credits are preserved and granted once for the term. Ordinary monthly renewal remains separate.

Validation: 34 focused tests passed across student pricing, subscription terms, checkout creation, bank approval and legacy activation. Tests cover a single USD 80 charge, 90-day activation, unchanged legacy 60-day terms, rejection of duplicate introductory purchases, and replay-safe credit grants. TypeScript and targeted ESLint passed. Browser checks at mobile width passed in Persian, English, German and Turkish, including the struck-through price and checkout link.

Production build passed and release 4239592 was deployed to /var/www/aifekr-release-4239592. The student package was created at USD 80 / 90 days with its existing 1000-credit allocation; the old two-month package was disabled for new sales. No historic payments or user entitlements were rewritten. A consistent database backup was saved privately at /var/www/aifekr-db-before-student-three-month.db before changing package configuration. Live mobile pricing was verified to show USD 240 struck through, USD 80, the 90-day term and the new offer checkout link without horizontal overflow.

Rollback uses release 56b77b9 plus disabling STUDENT_FIRST_THREE_MONTHS and re-enabling STUDENT_FIRST_TWO_MONTHS in the package catalog; historic entitlement snapshots should remain untouched. No full database restore is needed for a routine application rollback.
