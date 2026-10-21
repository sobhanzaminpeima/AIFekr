# Admin, student profile and receipt recovery QA — 2026-10-04

- Student activation now atomically assigns STUDENT account type, a finite student plan, University industry, workspace override and package credits. Repeating activation preserves an active term and does not double credits. Grants are recorded in AuditLog.
- User detail and invite card management expose an explicit student activation action. New admin accounts and trial invites can select the student package; public student registration continues into package checkout and never grants unpaid access.
- Student filtering resets incompatible plan filters; request sequence guards prevent slower previous searches from overwriting newer results. Student plan badges are explicit.
- User detail timeline combines registration, last login, administrative grants/edits, purchases and credit usage; password hashes are excluded from the response.
- Customer voice workspace exposes readiness and business settings, with no Vapi setup controls or vendor labels. Provisioning is admin-only; existing admin phone assignment remains available and is audited.
- Production server links reject localhost in production, including welcome emails, gateway callbacks and voice webhooks.
- Receipt notification addresses include configured contact and active administrators, with deduplication and BCC. Provider failures remain queued; financial dashboard displays acceptance status and offers authenticated, rate-limited resend.
- Production Resend configuration exists and there were no queued failed receipt notifications. The sending key cannot read delivery-event history (restricted_api_key), so inbox delivery has not been independently confirmed. No unsolicited live emails or phone calls were sent.
- Student photo uploads are bounded to 5 MB and decoded/re-encoded to canonical WebP. A profile photo up to 256 KB is persisted in the existing avatar field; no R2 setup or filesystem release path is required. Legacy R2 photos use a bounded, host-allowlisted same-origin proxy to avoid canvas CORS problems. Public photo reads require a public, active student profile.
- Student card title is localized in Persian, English, German and Turkish.
- 113 files / 811 tests passed with voice and bank integration enabled. TypeScript and changed-file lint passed.
- Browser QA: normal synthetic admin login, student activation of an existing personal account, student list filtering, normal student login and workspace access, real synthetic-image upload and rendered card photo/title, mobile viewport 390×844. Screenshots contain only synthetic QA identities. Native sharing was not executed.
- No database schema migration required.

- Large rial subscription amounts do not overflow the database foreign-currency minor field; the provider adapter alone converts stored toman to rial. Captured payment amounts and bank cents are validated against the database integer range. Production build passed.

Deployment verification: release bda26fe is live at /var/www/aifekr-release-bda26fe. PM2 ai-platform id 33 is online with zero restarts. HTTPS pricing and student landing return 200. The anonymous payment callback returns 307 to https://aifekr.com/plans?payment=failed, with no localhost link. Private avatar requests require login (401). A protected SQLite backup was saved before release; prior releases and dependencies remain available. Four deployment transfer archives were removed after verifying exact resolved paths. GitHub push remains unavailable because the local GitHub account is not authenticated.
