# Security & Privacy Review

| Area | Control |
|---|---|
| Authorization | Every admin endpoint uses `requireAdmin`; CSV export requires `SUPER_ADMIN`; turning on live messaging flags requires `SUPER_ADMIN`; users can only read/change their own onboarding and consent |
| Data boundary | Growth tables are keyed by AIFekr users. Tenant CRM data (`CrmContact` etc.) is never read except a per-owner count |
| Open redirect | `safeInternalPath`: relative only, no `//`, `\`, control chars or foreign host, allowlisted product prefixes; existing `getSafeRedirect` and Google `safeGoogleRedirect` still apply |
| Forged events | Client events limited to a non-financial allowlist; purchases, checkouts, credits and AI success come from `Payment`, `UsageLog` and artifact tables |
| Idempotency | Unique keys on events and messages; voice outcome events keyed by generation id; payment activation unchanged (`updateMany where PENDING`) |
| Credit integrity | The Voice Studio trial uses the existing reservation/settlement ledger, is re-checked inside the transaction, and is off by default. AI never changes balances |
| Templates | Fixed variable list, validated on save and at render; values stripped of `<>{}` and length-capped; output is plain text |
| CSV | Formula-injection neutralised, every export audited with filters and row count |
| Consent | Registration ≠ consent: an unchecked opt-in box; email only with `marketingConsent`; signed one-click unsubscribe (HMAC with `JWT_SECRET`); admins can stop messages but cannot grant consent |
| Minimisation | No IP, no full referrer URL, no prompts or generated content in events or timelines; anonymous id is random and first-party |
| Rate limiting | `/api/growth/*` 40/min per IP/user (proxy) |
| Audit | Settings changes (before/after), campaigns, notes, follow-up changes, message stops and exports go to `AuditLog` |

## Residual risks / decisions for the owner

1. **Cookie consent**: no consent banner exists on the site. The `afk_aid` attribution cookie is first-party and holds no personal data, but under GDPR it may still require consent for EU visitors.
2. **Trial abuse**: if `trialGenerations` is turned on, each new account can make short samples from its own signup credits; accounts are cheap to create. Keep it at 1 sample / 30 s and watch provider cost in the admin Voice Studio page.
3. **Unsubscribe via GET**: email security scanners that pre-fetch links could unsubscribe a user. Accepted for one-click simplicity.
4. **`notify()` swallows errors**, so a failed in-app write is recorded as "sent" in `GrowthMessage`.
