# Implementation Checklist

| # | Item | Status |
|---|---|---|
| 1 | Repository audit (`architecture-audit.md`) | Done |
| 2 | Additive migration, 6 `Growth*` tables | Done (applied locally; not on production) |
| 3 | Settings + feature flags with safe defaults, audited | Done |
| 4 | Event ingestion (server + allowlisted client), idempotent | Done |
| 5 | First/last-touch attribution with confidence | Done |
| 6 | Destination kept through login/register/OTP/Google, open-redirect guard | Done |
| 7 | Contextual onboarding for module campaigns | Done |
| 8 | Voice Studio landing page (`/features/voice-studio`) | Done |
| 9 | Smart onboarding (save/resume/skip, real modules only) | Done |
| 10 | Voice Studio first/second-value events from final state | Done |
| 11 | Voice Studio trial (configurable, ledgered, default off) | Done |
| 12 | Upgrade recommendation from real packages + return to module after payment | Done |
| 13 | Customer facts from authoritative tables (12 modules) | Done |
| 14 | Stage, explainable score, bands, 11 segments, risk reasons | Done |
| 15 | Admin Growth Center: overview/funnel, campaigns + URL builder, customers, automations, settings | Done |
| 16 | Customer 360 with timeline, notes, follow-up, message stop | Done |
| 17 | Lifecycle rules, caps, quiet hours, consent, dry-run preview, cron route | Done (sending off by default) |
| 18 | Marketing consent at signup + one-click unsubscribe + own-consent API | Done (no settings-page toggle UI yet) |
| 19 | Sidebar entry under "People & contacts" | Done |
| 20 | Unit tests | Done (`src/lib/growth/growth.test.ts`) |
| 21 | AI-written customer summaries | Not done — rule-based "next action" instead (flag exists, off) |
| 22 | A/B experiments | Not done |
| 23 | Push/other channels | Not added (in-app + email only, as integrated today) |
| 24 | End-to-end browser tests | Manual verification only |
| 25 | Production deployment | Not done — awaiting approval |
