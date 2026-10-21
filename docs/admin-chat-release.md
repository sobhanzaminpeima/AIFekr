# Admin navigation, PLAY and independent chat

Admin navigation is grouped into collapsible localized sections with search, specific active-route matching, visible module registry and separate user access management. PLAY administration uses Overview, Rules, Players, Competitions and Questions sections; operations and ownership checks remain server-controlled.

## Attachments

The existing workspace chat paperclip now opens a document picker. `/api/chat/attachments` accepts text PDF (up to 40 pages), DOCX, TXT, Markdown, CSV and XLSX, maximum 5 MB. Text is bounded to 16,000 characters, signed to the authenticated owner for one hour and verified again on message submission. Up to three attachments per message. Raw files are parsed in memory and not retained or exposed through public URLs. Office archives reject embedded/macro content and excessive declared expanded sizes. Document contents are wrapped as untrusted input. Scanned PDFs without selectable text get an explicit OCR instruction, rather than a fake successful extraction. Malware scanning is not configured; this release does not offer raw-file hosting/download or execute macros. Parser sandboxing and antivirus are future hardening work.

## Independent AI Chat continuation

The separate `/api/ai-chat/v1` foundation is shipped disabled by default. `/admin/ai-chat` manages quotas, conservative global API limits, the installed Cloudflare text model, discovery toggles and aggregate operational statistics without private transcript access. Existing workspace users retain their current chat interface and media tools. New independent chat has server-enforced three-success guest quota, signed guest identity, idempotent requests, one pending request per identity, explicit credit reservation/refund, 45-second provider deadline, guest-to-account merge and chat-only access boundaries. Current v1 supports text only; advanced tools are not advertised. Module discovery remains disabled by default.

No new paid provider was enabled and no live paid inference was run for this release. Independent chat activation is an admin policy choice and should follow staging acceptance. New tables use additive migration `20261021120000_independent_ai_chat`; `User.chatOnly` defaults false and existing subscriber access is preserved. Guest retention defaults to seven days; request transcripts are cleared after 30 days, while durable accounting remains. Retention runs opportunistically on session initialization; a scheduled cleanup is recommended for low-traffic installations.

## Verification and limitations

`npx vitest run src/lib/chat/documents.test.ts src/lib/ai-chat/service.integration.test.ts` exercises real text/XLSX parsing, signed ownership/tamper checks, actual additive SQLite migration, three-success quota, failed-turn handling, duplicate retries, merge idempotency/ownership, and credit refunds for expired module subscribers. No live provider budget is consumed by these tests.

The independent-chat prompt is not fully complete: full device/browser OAuth E2E, CAPTCHA integration, provider fallback/circuit breakers, per-model economic registry, file support in the new guest composer, consented conversion-to-payment attribution, experiments and approved copy editing remain. Local browser automation is disabled in Work settings, so no visual browser QA is claimed. Legacy workspace file attachments are functional separately from these unfinished v1 capabilities.
