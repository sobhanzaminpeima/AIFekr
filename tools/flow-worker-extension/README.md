# AIFekr Flow Worker — experimental

This extension drives the owner's existing Flow page. It does not replay private
Google endpoints or export Google session credentials. No database migration is required.

## Current scope

- One IMAGE scene at a time, model identifier `flow-image`.
- English Flow controls, aspect ratios 16:9, 9:16 and 1:1, one output.
- Dedicated Flow project tab; do not generate manually or run other automation in it.
- Character-reference uploads are not implemented: these stop with `REFERENCE_REQUIRED`.
- Generation and download against the live Flow UI have **not** passed acceptance.
  Do not enable this provider for customers yet.

## Setup after acceptance

1. Configure a random, scoped `VIDEO_FACTORY_FLOW_WORKER_TOKEN` on the backend
   (at least 32 characters); never use a Google token or an administrator session.
2. Load this directory as an unpacked extension in Chrome after owner approval.
3. In the extension options, enter the scoped token and exact dedicated Flow project
   URL. Keep the worker disabled until the backend provider and test order are ready.
4. Register a disabled IMAGE provider using `GOOGLE_FLOW_IMAGE`, model `flow-image`,
   no credentialRef/secret. Set reviewed pricing and enable only for controlled tests.
5. The default maximum Flow cost is zero credits per image. The worker stops if
   the displayed cost exceeds the configured ceiling or cannot be read.

## Recovery contract

The backend leases scenes and records START before the browser clicks Generate.
The extension persists its local journal before START. Neither side blindly retries
generation following a crash or ambiguous acknowledgement. Uploads can be retried;
the backend deduplicates stored output and charges the step once. Missing journals,
multiple new images, changed UI, and uncertain results stop for operator review.
Browser shutdown/sleep suspends work. The local journal survives worker restart.

The driver currently identifies output by a new Flow image URL in the dedicated
tab. This requires validation against the actual UI; unrelated uploads in the same
tab would make attribution unreliable. Production activation remains blocked until
real generate → download → upload → render recovery is verified.

## Local tests

`node --test tools/flow-worker-extension/worker.test.cjs`

Backend tests: `flowProtocol.test.ts` and the isolated `service.integration.test.ts`.
