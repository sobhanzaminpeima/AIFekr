# Payment currency routing QA — 2026-10-04

- IRR checkout uses existing Zarinpal configuration, storing amount in toman and sending rial (×10) through the existing provider adapter.
- TRY and EUR explicitly select their respective configured IBANs regardless of the admin default currency.
- Verified gateway callbacks bind authority to the stored payment and use the bank activation transaction for captured student, business and credit entitlements. Repeated callbacks cannot grant credits twice.
- Existing CRM, voice, student and credit purchase buttons submit IRR for Persian, TRY otherwise; package checkout offers IRR, TRY and EUR.
- 109 test files / 789 tests passed with bank and voice integration enabled. TypeScript check and production build passed. Core payment files lint passed; broader CRM lint exposes 16 pre-existing unused parameters.
- Local production preview: normal synthetic-account login; confirmed IRR selector, automatic activation wording, EUR selection and receipt review wording. No real gateway payment was made.
- Production configuration checked without disclosing credentials: merchant configured, sandbox false, app URL https://aifekr.com, TRY/EUR configured IBANs match the supplied validated accounts.
- No database schema changes.
