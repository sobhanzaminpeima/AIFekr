# Voice Studio audit — 2026-10-26

Baseline: GitHub main 641a202; production /var/www/aifekr-release-641a202. Audit precedes implementation.

## Existing dependencies and boundaries

- Next.js 16.4.3 App Router, React 19.3.1, TypeScript 5.9, Node 20, Prisma 5.22 and production SQLite. Additive migrations only. The original checkout contains unrelated uncommitted work; implementation uses an isolated worktree.
- User authentication: requireAuth supports signed web cookies and native sessions, blocked users and subscription restrictions. Admin checks must use current database roles, not a browser claim. Business context comes from resolveOrganizationContext; never accept a tenant identifier from the request.
- Existing billing: User/Team credit pool, atomic reserveLoggedCredits and refundLoggedReservation, UsageLog ledger, existing plan expiry. Voice Studio consumes AIFekr credits through that pool; telephony voiceMinutes and Voice Agent billing remain unchanged. No new wallet or purchase flow.
- Existing registry: MODULE_PLANS, ModuleRegistry, moduleRoutes, proxy, user Sidebar and AdminNavigation. Voice Studio receives its own key and routes, separate from voice-agent.
- Existing media: R2 S3 client and signed downloads. Current uploadToStorage can return a public URL or a development placeholder; private Voice Studio outputs require a fail-closed private upload helper using the same client. No ephemeral final output.
- Existing ElevenLabs: music adapter and Video Factory TTS/model vault. Reuse encrypted credentials via secretBox, but isolate interactive voice quotas/pricing from Video Factory and telephony. Live voice/model discovery is required; no assumed Persian support for every model.
- Jobs: existing durable database-job pattern, cron-authenticated workers and PM2. Add a dedicated durable audio queue; do not run paid work from client polling. Ambiguous requests require reconciliation, not blind retry.
- FFmpeg/ffprobe are present on production and already used by Video Factory. Reuse the trusted binaries for verified duration and waveform extraction, with bounded subprocesses and temporary files removed afterwards.
- Existing shared notifications, audit log, CSS theme tokens, language hook (fa/en/de/tr), accessible form/dialog patterns, scoped tests and migration test databases are available.

## Dependency map

User Sidebar -> /voice-studio -> authenticated API -> module/plan/business checks -> VoiceProject + VoiceGeneration -> existing atomic credit reservation -> durable worker -> typed ElevenLabs adapter -> ffprobe duration check -> private R2 upload -> atomic settlement/refund -> existing UsageLog/AuditLog -> owner-authorized playback/download.

AdminNavigation -> /admin/voice-studio -> admin API -> versioned settings + encrypted provider key + discovery/readiness + job reconciliation + usage/cost reporting.

Other modules -> owned READY audio reference -> authorized asset lookup. Cross-module actions remain disabled unless the consuming module is explicitly supported and tested; no fabricated integration buttons.

## Billing and recovery policy

Defaults: project <=20,000 graphemes, each segment <=60 seconds, 45 credits per started 30 seconds (alternative 20-second interval). Segment text before queuing, show approximate duration, and reserve the full configured duration ceiling per segment (default 90 credits). Actual duration drives settlement; unused reservation is refunded in the original payer wallet. Pricing and payer are immutable snapshots. Ordinary playback/download do not charge.

Overlong audio is not delivered or silently truncated; the user receives a full AIFekr refund and the provider cost is recorded. Known rejected provider requests refund. Timeout/5xx/storage uncertainty move to REVIEW and retain reservation until a no-charge/accepted-output outcome is confirmed. Paid requests are never automatically replayed. A stale worker lease also becomes REVIEW. Retention removes files only after durable deletion state; access is denied immediately.

## Migration and rollout risks

Add only module tables and indexes; retain existing payment/credit schemas. Back up SQLite, run migrations on a backup copy, compare schema and foreign-key baseline, then migrate production. Fail closed on missing R2/credentials/model data. Default sales/generation flag off until connectivity, storage, funded-wallet and paid smoke tests succeed. Paid smoke budget authorized separately by the user: maximum USD 1, with real AIFekr credit accounting. Cloning, dubbing and voice changer are out of scope and remain unavailable.

## Navigation audit

Preserve all existing deep links and department groupings. Add Voice Studio alongside creation tools and add module settings under admin AI modules. Do not move or rename /voice-agent, /music, /video-factory, /social or existing industry workspaces. The existing sidebar is not replaced wholesale.
