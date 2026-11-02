# Voice allowance, creator offer and admin corrections — 2026-11-02

## Owner-approved changes

- Two lifetime free voice samples per account outside the approved voice plans, each capped at 30 seconds; no AIFekr credit charge. Pending/unknown outcomes occupy an allowance, confirmed failures/cancellations release it. User-level write locking and idempotency protect repeated submissions. Paid generations continue using their immutable billing snapshot.
- An explicit admin paid-plan assignment now supplies a 30-day term when no valid existing term is available. Existing valid terms are preserved. Existing production accounts are not bulk extended or credited.
- Creator offer `VF_CREATOR_5`: five videos of up to 60 seconds, AIFekr-generated script, images/animation and multilingual ElevenLabs narration, 500 credits, 30-day access. List price 7,000,000 toman; sale price 4,250,000 toman. Eligible paid snapshots select a package-specific budget capped at 100 credits per film. Ordinary packages retain their rates; failures use the existing refund/quota-restoration path.
- The factory ElevenLabs adapter uses the same configured transport as Voice Studio. Only narration is enabled for this offer; music remains disabled.
- Settings only load known form fields and submit the active section, preventing per-user preset/cache keys with colons from invalidating language saves. Turkish is supported and default-language values are checked server-side.
- Logout is visible in the live UI sidebar and invokes the existing logout endpoint. Free voice pricing/remaining allowance and creator list/sale prices are shown in the new UI. Creator packages are reachable from public pricing and admin content pricing.
- The existing admin design tokens/frame are retained. User management has responsive summary cards, clearer filters/actions and checked plan-save errors.

## Evidence

- Full isolated local suite: 1,384 passed, 88 skipped, zero failures (247 files). Focused voice/factory/admin suite: 123 passed, four skipped. TypeScript passed in backend and UI; both production webpack builds completed.
- Production read-only inspection found Pro accounts without expiry, consistent with the voice plan gate rejecting them. No users were altered during diagnosis.
- Settings inspection confirmed non-form preset keys with colon separators; these are now excluded from the settings form payload.
- Instagram logs contained an `already_connected` failure, meaning the requested Instagram identity was attached elsewhere. Existing connections were not disconnected or transferred. Browser control remains disabled in this environment, so OAuth reconnection was not completed.

## Release identifiers and limitations

- Backend runtime build: `ef4b3434`; follow-up `fd50f2c2` changes only the reversible deployment configuration script.
- UI runtime build: `ce742a7a`.
- Previous backend `.next-rel-513d7a47` and UI `/var/www/aifekr-ui-v2-77a11b6` are retained for rollback. The deploy script also preserves and can restore only the changed configuration rows without restoring over user transactions.
- No new paid provider generation, real payment, or production-user login was executed. Narrated bundle generation was verified with local provider/renderer mocks; a real 60-second paid production run is not certified by those tests. Image generation has not been diagnosed because no specific new image error was supplied.
