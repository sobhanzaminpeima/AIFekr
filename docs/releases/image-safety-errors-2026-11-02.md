# Image error classification — 2026-11-02

The owner supplied a growth summary ending in one provider error for image generation. Read-only production log inspection found one image-route error with OpenAI HTTP 400 and a safety-system message. No prompt, output, token or customer identity was printed. A precise match between this log and the supplied aggregate cannot be established without the request time.

Previously the adapter threw a generic exception, the route converted it into HTTP 500, and growth tracking classified it as a provider outage. The correction recognizes explicit content-safety error codes/messages from HTTP 400 responses, emits `IMAGE_SAFETY_REJECTED` with HTTP 400, and reports `content_blocked` with a clear label in the admin growth view. The new UI explains that the prompt/reference was not accepted and no AIFekr credits were deducted. The route reaches this branch before charging credits.

Provider text is not forwarded to the client or included in the typed exception. Other upstream HTTP failures remain distinct generic errors. No automatic retry, prompt rewriting, provider switching, moderation changes or historical analytics rewriting was added.

Validation: 11 focused image-error/growth tests passed, and TypeScript passed in backend and UI. Both production builds are required before deployment. No new paid generation request was executed; this validates handling of mocked provider errors rather than a new image-generation acceptance run.

Backend runtime source: `043cbb92`. UI runtime source: `c7a89831`. Previous runtime pair `.next-rel-ef4b3434` and `/var/www/aifekr-ui-v2-ce742a7a` remains the rollback pair. No database schema, account, package, rate or provider setting is changed by this release.

Deployment completed successfully after both production builds. Preview health, UI loading and unauthenticated image-POST rejection passed. The active pair was switched and public home, pricing, login and language routes returned 200; PM2 state was saved. No new generation request was submitted.
