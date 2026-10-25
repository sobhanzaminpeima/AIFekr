# AIFekr native application — initial slice

Expo SDK 57, React Native, TypeScript and Expo Router. This is an incomplete native integration, not the completed super app.

Copy `.env.example` to `.env`; use the HTTPS origin of a controlled backend with `MOBILE_API_ENABLED=true`. Never put provider keys in public environment variables. Run `npm ci`, `npm run typecheck`, `npm start`. Run API client tests from the repository root: `npx vitest run --config mobile/vitest.config.mts`.

Account reads, shared credit display, CRM contacts, workspace switching, notifications and gallery reuse existing server authorization. Workspace switching requires confirmation because it also changes web context. Foregrounding refetches current data. Sessions use native Bearer access and rotating refresh credentials stored together in SecureStore; device revocation and logout are server-backed when online. Apply the additive native database migrations to controlled staging before enabling mobile access. FIKA text chat streams real backend responses with explicit credit consent and duplicate protection. Voice, business actions and new studio generation remain pending. See `../docs/mobile/09-native-session-release.md` for deployment and security limits.

No signing identifiers or store credentials are configured. Template icon assets are development placeholders, not approved AIFekr store branding. See `../docs/mobile/06-release-plan.md` for build/release gates and `07-implementation-status.md` for remaining scope.
