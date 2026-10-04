# AI call service audit — 2026-10-04

Implementation commit: `4d96af6`. Production release: `/var/www/aifekr-release-4d96af6`. Only the ai-platform PM2 service was switched. Other applications were left running.

## Fixed

- Vapi event authentication fails closed when the webhook secret is missing. Provider credentials are not returned by the configuration API. Provider errors no longer disclose response bodies.
- Current toolCallList, artifact transcripts and analysis summaries are processed. Replayed call reports and booking tools do not double-charge or duplicate appointments.
- Calls reserve the configured duration budget atomically. Concurrent reservations cannot overdraw available credits. Actual seconds determine the final integer credit charge; unused reservations return to the original personal or team wallet even if membership changes.
- Definite outbound rejection refunds the reservation. An ambiguous network timeout keeps it held pending a provider report. Admin reconciliation fetches the real Vapi call rather than trusting a manually supplied duration. Unreserved legacy reports are recorded and settlement cannot overdraw a wallet.
- Reception, clinic, general-business and real-estate scenarios have separate prompts/tool permissions. Call language, time zone, opening/closing hours, appointment duration and assistant instructions are configurable and editable. Persian voice/transcription configuration follows current provider documentation.
- Appointment tools validate date offsets, future dates, opening hours, duration conflicts, property availability and idempotency. Requests remain pending staff confirmation.
- Voice data and tools are scoped to the owner and exact active business. Knowledge uploads now retain business ownership. Invalid provider setup and property values return validation errors.
- Phone assignment uses purchased/imported Vapi inventory from the administrator. A number cannot be allocated to two agents. Disconnecting an agent does not delete a purchased provider number. Provisioning has a per-agent lock; call/appointment history prevents destructive agent deletion.
- Admin setup exposes masked credentials, inventory checks, customer number assignment, rate/duration controls and call reconciliation. Platform mutations show failures rather than appearing successful.
- Signup persists PERSONAL / STUDENT / BUSINESS intent without granting a paid subscription. Student package selection and completed student purchases classify the user as STUDENT. Business bundle signup/purchase classifies BUSINESS. Administrator user lists support audience filtering. Existing student/team/CRM owners are backfilled.
- Iran displays +98 while canonical legacy Iranian phone storage is preserved; Northern Cyprus is available with +90; international/Persian digits normalize without a duplicated prefix. Turkish signup preference is persisted.

## Verification

41 targeted tests passed across six files: voice billing/webhook integration, provider contract tests with mocked fetch, signup/admin/ownership route integration, bank-payment integration, student offer and package currency tests. Cases include replay, simultaneous reservations, expiry/insufficient funds, failed-call refund, team membership changes, legacy reports, conflicting/past bookings, estate tools rejected for clinics, student intent without paid privileges, Northern Cyprus/Turkish signup and cross-owner edit rejection.

`tsc --noEmit --incremental false` succeeded. Targeted lint succeeded. Production build succeeded. Authenticated local production HTTP checks returned 200 for agent listing, audience-filtered admin users, voice configuration and call reports. Unauthenticated protected checks returned 401/403; the unauthenticated webhook returned 401.

Production internal preview passed before activation. Public HTTPS checks after activation: /, /pricing, /register?plan=STUDENT_FIRST_THREE_MONTHS and /voice-agent returned 200; /api/voice-agent/agents returned 401; /api/admin/voice-agent/config returned 403. PM2 ai-platform remained online after activation.

A SQLite backup was taken before the additive schema upgrade: `/var/www/aifekr-db-before-voice-4d96af6.db`, mode 600. The previous release and shared dependencies were retained. The upgrade script supports dry run and refuses duplicate phone allocations. Transfer archives and the temporary server preview were removed after activation.

## Operational setup still required

The production database contains a private-key setting, but a read-only Vapi inventory request returned HTTP 403. A valid account/key must be supplied; this result alone does not identify whether the cause is key permissions or provider account restrictions. Webhook secret and server credential ID were absent. There were two stored voice agents, no assigned numbers and no historical call logs before migration.

1. In /admin/voice-agent enter a valid private key and a random webhook secret of at least 32 characters.
2. In Vapi Server Configuration create a Bearer Token credential for that same secret, retaining Authorization and the Bearer prefix. Save its Credential ID in the platform admin settings. Webhook URL: https://aifekr.com/api/webhooks/vapi.
3. Purchase/import the intended virtual number in the provider account, check inventory and assign it to a subscribed customer's agent. Ensure that account balance and model/voice access support the selected configuration.
4. Set a credit rate that covers provider and telephone costs. The default 10 credits/minute is a configurable policy, not a verified profit margin. Provider balance and platform credits are separate.
5. Perform controlled real inbound/outbound calls, no-answer and hang-up tests, appointment booking, low-credit denial, webhook replay, transcript/recording checks and reconciliation. Confirm audio quality and measured provider charges before opening service broadly.

No paid call or number purchase was initiated. Live telephony and voice quality are not verified. Browser surfaces were unavailable in this session, so visual mobile QA of these changes remains unverified; HTTP and backend tests are not a substitute for that check. Absolute absence of bugs cannot be guaranteed.

Git changes were committed locally. GitHub publishing remains subject to restoring the previously failed GitHub authentication; this audit does not claim a remote push.

Provider references: https://docs.vapi.ai/server-url/server-authentication ; https://docs.vapi.ai/server-url/events ; https://docs.vapi.ai/providers/voice/elevenlabs ; https://docs.vapi.ai/providers/transcriber/openai
