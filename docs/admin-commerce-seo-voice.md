# Admin commerce, SEO notifications and scanned-material support

## Architecture
Existing Prisma SQLite, authentication/RBAC, Payment, referral attribution, Notification and credit reservations are reused. There is no second payment, credit or referral ledger.

## Admin
- `/admin/financial/customers`: searchable buyers, successful purchase totals grouped by currency, expiry history.
- `/admin/financial/invoices/[id]`: authoritative payment/receipt details and printable invoice.
- `/api/admin/financial/expiry`: privileged reason-required expiry adjustment, optimistic concurrency and audit log; AI team expiry stays synchronized.
- `/admin/referrals`, `/api/admin/referrals`: existing referral owner codes, first-purchase discount 0–50%, case-insensitive collision prevention and audited updates.
- Existing voice administration embeds Telnyx encrypted credential configuration, free connectivity test and import of existing active numbers through the current voice provider.

## Referral and packages
Registration code and referral links set the same inviter. Discounts are server-calculated, stored on Payment and exclude credit purchases. Existing purchased features remain unchanged. SEO Intelligence is visible in business packages, home and SEO sidebar. All new primary flows support Persian, English, German and Turkish.

## Scanned PDF and images
Student material OCR accepts images, scanned PDF and PPTX. PDF rasterization uses Poppler `pdfinfo` and `pdftoppm`, temporary-directory cleanup and bounded rendering. Maximum PDF upload: 10 MB, 12 pages. Existing student OCR reservation: 2 credits; failures refund. Vision requests are chunked and truncated output rejected. PDF text parsing imports the library implementation directly to avoid its test-fixture entry point.
Install `poppler-utils` on Linux; optional PDFINFO_PATH/PDFTOPPM_PATH override binaries. Existing vision AI environment configuration is reused.

## Email
SEO research completion/failure and audit/content activity create durable notifications. Existing minute SEO worker delivers queued mail with atomic claims, bounded retries and provider idempotency keys. Requires existing RESEND_API_KEY and RESEND_FROM. Missing configuration never records false delivery. Migration marks historical completed research as already notified to avoid retrospective mail.

## Security
Telnyx API key and voice provider secrets use existing secret encryption. Ordinary users never see provider credentials. `/api/webhooks/telnyx` checks Ed25519 signature, raw payload and timestamp; repeated event IDs are idempotent. Telnyx diagnostic events do not debit credits; existing voice billing remains authoritative. Import needs an active Telnyx number and the voice provider Telnyx credential ID. No numbers are purchased automatically.

## Migration and deployment
Apply `20261009110000_commerce_seo_notifications` using normal Prisma migration deploy after a consistent production backup; then regenerate Prisma. Changes are additive. Existing business package feature descriptions are updated without changing prices or entitlements. Deploy the matching Next production build, preserve shared uploads and environment, then verify workers and PM2.

## Verification
Standard suite: 133 files passed, 6 skipped; 893 tests passed, 79 skipped. Explicit integration guards: 6 files / 84 tests passed. Final targeted payment/referral/expiry/OCR bounds/signature/email checks: 6 files / 41 tests passed. These runs overlap and must not be summed as unique tests.

## Practical limits
A customer scanned document has not been supplied for a content-quality check. Telnyx connectivity is valid but inventory is empty, so real call delivery requires adding a number and completing provider routing. Email delivery remains dependent on provider acceptance and recipient deliverability.
