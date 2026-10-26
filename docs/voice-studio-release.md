# AI Voice Studio — implementation and release record

Date: 2026-10-26. Baseline: main `641a202`. Feature flag defaults to OFF.

## Architecture and changes

Two additive Prisma models persist projects and generation jobs. Owner and active business scope are resolved by the existing organization service. The existing credit wallet, team pool, UsageLog, AuditLog, notifications, encrypted settings, module registry and R2 client are reused. There is no additional wallet or payment system.

User route `/voice-studio` is in the Create sidebar group. Admin route `/admin/voice-studio` is in the AI administration group. Existing navigation remains in place. `voice-agent` remains independent. Private routes are excluded from search indexing.

Core implementation: `src/lib/voice-studio/{domain,config,provider,service,worker,audio,request}.ts`; UI: `src/components/voice-studio`; APIs: `/api/voice-studio`, `/api/admin/voice-studio`, `/api/cron/voice-studio`; shared additions: `teamCredits.ts`, `storage/r2.ts`; worker: `scripts/voice-studio-worker.cjs`.

## Contracts

Authenticated GET `/api/voice-studio` returns public policy, verified model/voice catalog, available credits, presets and latest 100 projects. `?project=ID` returns latest 100 owned generations. `?audio=ID&download=1` authorizes ownership and redirects to a 60-second signed private URL without charging again.

Same-origin authenticated POST supports `save`, `generate`, `cancel`, `deleteProject`, `deleteAudio`, `savePreset`, `deletePreset`. Generate requires a UUID idempotency key and approved model/voice, supported language, current catalog, available plan, private storage and full reservation balance. The server independently segments stored project text. Payloads are bounded even without Content-Length. Cross-user/business IDs fail closed.

Admin GET returns sanitized readiness, policy, latest 100 jobs and totals. Admin POST supports read-only `test`, versioned `settings`, and audited `reconcileNoOutput` with explicit confirmation and written evidence. Cron POST requires the shared cron secret. No user-facing request triggers a paid retry.

## Credits and duration

Default: 45 AIFekr credits per started 30 seconds. Alternate 20-second intervals are independently versioned. Each output reserves the full 60-second ceiling: 90 credits by default, 135 for the alternate interval. Actual ffprobe duration determines final charge. Unused reservation is returned atomically; the original reservation ledger entry is immutable. Download, refresh and polling cost no additional credits.

Projects allow up to 20,000 graphemes, with an additional bounded request size. Unicode segmentation preserves the full text. Estimated short segments are independent outputs, not silent truncation. Actual output over 60 seconds is not delivered and receives a full AIFekr refund. Provider costs already incurred remain visible to the operator.

Known provider rejection/preflight failure refunds once. Network ambiguity, lost provider response or post-provider storage failure enters REVIEW and retains reservation until audited reconciliation. Paid POST is never automatically retried. A worker interrupted after dispatch enters REVIEW. Deterministic storage keys are persisted before upload for recovery.

Provider cost estimates are nullable, versioned and admin-managed with source/date. Unknown cost is not represented as zero. A successful future smoke test must debit an explicitly selected authorized AIFekr account through the same reservation/settlement path; it has not yet happened.

## Verified evidence

- Fresh isolated SQLite database: full existing migration chain plus `20261026160000_voice_studio` applied successfully. No production data was used for tests.
- 35 focused tests passed: Unicode boundaries/segmentation, pricing, concurrent wallet requests, idempotency, immutable ledger, cancellation, tenant isolation, presets, signed access contract, worker success, overlong output, quota/rejection refunds, ambiguous/storage failure without a second paid call, adapter versioned endpoint routing, bounded JSON, authenticated routes, admin role enforcement and CSRF boundaries.
- Final TypeScript check passed after the UI/adapter refinements. Combined focused and existing wallet/auth regression run: 71 tests passed in 9 files.
- Final production build passed using the migrated isolated database. Initial empty-DB build warnings were resolved by using the migrated database.
- Scoped lint passed with zero errors and warnings. Production ffmpeg/ffprobe validation of a synthetic MP3 passed: 1,045 ms, 80 waveform points. This is a media pipeline test, not an ElevenLabs generation.
- Persian RTL and English LTR were rendered in the local visual fixture using the real component at a narrow viewport. This is fixture verification, not authenticated production end-to-end testing. Desktop-width and real provider playback remain pending.
- Existing production public R2 bucket: signed and public GET both returned 200. It was unsuitable for private audio. A separate default-private bucket was created and probed: signed GET 200, unsigned GET 400. `R2_PRIVATE_BUCKET_NAME` was configured in production `.env.local`; no existing bucket exposure settings were changed. Temporary probe objects were deleted.
- Production ElevenLabs `/v1/models`: 403. Existing relay ElevenLabs route: 404. Local key: voices 200, models and subscription 401 `missing_permissions`, including the first recheck after the user reported permission updates. No paid synthesis has been dispatched; USD 1 budget remains unused.

## Rollout and rollback

Keep generation disabled until current catalog discovery, quota access, direct server connectivity, verified provider tariff and a real end-to-end output all pass. Do not enable merely because an API key is present. Secrets stay in environment/encrypted settings, never in source, browser or logs.

Before production migration: create a SQLite backup via the backup API; run migrations against a copy; verify schema and baseline record counts; then apply additive migration. Build locally rather than on the 2 GB VPS. Give the new release its own generated Linux Prisma client. Start a preview on another port and check public pages and protected routes before switching PM2. Preserve `/var/www/aifekr-release-641a202` and existing Video Factory worker. Rollback switches PM2 back; the additive tables may remain. Never drop customer data to reverse this release.

Run worker with existing Node and PM2, `scripts/voice-studio-worker.cjs`, `APP_URL` targeting the local application and the existing CRON_SECRET. Default OFF policy prevents dispatch. Worker recovery never retries an uncertain paid generation.

## Remaining scope and limitations

Provider/network permissions are genuine activation blockers. Final paid generation, production audio playback, private CORS/range behavior and real account credit settlement are unverified. Cross-module imports (Video Factory/social/student/business) are deliberately not advertised or enabled until a receiving asset contract and end-to-end tests exist. Existing silent Video Factory restrictions remain intact. Library currently returns latest 100 records; pagination, bulk export and richer project-level reporting are follow-ups. No claim of full production readiness or zero bugs is made.

## Production result

Code commit `adc2bfe` deployed at `/var/www/aifekr-voice-adc2bfe`. Consistent backup: `/var/www/aifekr-maintenance/backups/pre-voice-adc2bfe.db`. Trial migration applied successfully and schema diff returned no differences before the additive production migration. The new release has its own generated Prisma client. PM2 `ai-platform` and `aifekr-voice-studio-worker` are online; worker heartbeat confirmed. Existing Video Factory worker remains online.

Public external checks: `/`, `/en`, `/de`, `/tr` → 200; both Voice Studio APIs without authentication → 401. Read-only authenticated checks: `/voice-studio`, `/admin/voice-studio`, `/api/voice-studio`, `/api/admin/voice-studio` → 200. Admin readiness confirms privateStorage=true, configured=true, workerHeartbeat=true. Policy remains enabled=false and catalog is not yet verified. No paid synthesis or customer credit deduction occurred.

GitHub: https://github.com/sobhanzaminpeima/AIFekr/pull/3 (draft). Changes are pushed on `codex/voice-studio`; main has not been merged. Draft state records the unresolved provider activation and cross-module acceptance scope.

Official references: https://elevenlabs.io/docs/api-reference/voices/search ; https://elevenlabs.io/docs/api-reference/text-to-speech/convert ; https://elevenlabs.io/pricing/api ; https://developers.cloudflare.com/r2/buckets/public-buckets/ ; https://developers.cloudflare.com/r2/api/s3/api/ .

## Activation and unpaid-order follow-up

The existing platform CONNECT tunnel reaches ElevenLabs successfully (TLS verified end to end): voices 200. Exact remaining key scope errors: `models_read` and `user_read`. Voice transport now uses this existing tunnel instead of the absent ElevenLabs reverse-proxy route. No external proxy service or new credential is introduced.

Fixed activation with a submitted key: discover against that key, validate available models, then atomically store policy + encrypted key + verified catalog. Previously activation checked the old catalog then deleted it when saving the new key. The admin can test a submitted key before saving it; changing the global module visibility now links to the separate generation setup. Provider errors are translated with concrete missing permissions.

Admin financial history now offers cancellation with a required reason and an existing payment continuation link. Cancellation preserves the payment and audit records, releases promotion/fitness reservations atomically, never grants credits, and refuses completed payments or receipts awaiting review. Existing Zarinpal authorities are verified before cancellation; already-paid transactions settle instead, while uncertain provider results block cancellation. Saved continuation URLs are restricted to the official checkout host. Cancelled orders are filterable. No real customer order was cancelled during verification.

Follow-up validation: 57 tests across 10 files, TypeScript, scoped lint and production build passed. Tests cover activation/new credential ordering, failed preflight without enabling, atomic cancellation, receipt protection, terminal statuses, gateway uncertainty and paid-order settlement. API-key permission changes themselves remain controlled by ElevenLabs, not the AIFekr database.
