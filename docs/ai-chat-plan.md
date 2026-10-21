# Independent AI Chat: audit and delivery plan

## Existing system

Next.js 14 App Router, Prisma/SQLite, existing JWT cookie and mobile bearer authentication. `/chat` is currently under the authenticated dashboard shell, which redirects guests and unfinished onboarding. `ChatInterface` is a large existing workspace client with streaming, Markdown and media/provider integrations. `/api/chat` calls the business orchestrator unless explicitly disabled and checks subscription-based authentication. Conversations and messages already exist and must be reused. Current post-generation charging can lose a race when multiple requests consume the last credits.

Registration creates FREE accounts with the established 200-credit grant and PERSONAL/STUDENT/BUSINESS/FITNESS audience. This change must not alter paid-user entitlements. New independent chat uses a separate chatOnly capability, not a new role. General chat never runs workspace tools. The existing dashboard UI remains available to module subscribers.

## P0 implementation

1. Add signed guest sessions, idempotent requests and daily quota records; reuse Conversation/Message and existing reservation/refund accounting.
2. Move the `/chat` entry out of the unconditional dashboard login wall. Provide standalone localized guest/chat-only UI, preserve drafts and merge guest history exactly once after login.
3. Stream bounded provider responses through the existing provider adapter, with explicit cost/free quota, abort, timeout, settlement and refund. No guest tools, uploads or tenant data.
4. Add conversation ownership, CRUD, export, edit/regenerate and feedback; minimal chat navigation.
5. Add aggregate admin settings and disabled-by-default optional module discovery. Match only current-message explicit task rules and verified public routes; no sensitive targeting.
6. Isolated SQLite/mock-provider tests, type check, lint, build and staging checks. Production rollout and paid inference remain unapproved for this change.

## Data and dependency map

Additive User.chatOnly defaults false. AiChatGuest contains expiring guest identity, bounded transcript and merge ownership. AiChatRequest contains idempotency, status, reservation and provider usage; AIChatQuota protects daily concurrency. Existing Conversation/Message carry authenticated history. SiteSetting holds validated policy/discovery settings without provider secrets. Secret references resolve through current CustomAiProvider vault. Existing signup/login/OAuth continue authenticating; returning `/chat` claims the signed guest session using the logged-in identity.

## Risks and boundaries

Guest cookies can be cleared, so persistent signed identity is combined with bounded privacy-preserving IP issuance limits and request budgets; this is not proof of a human. Captcha needs a configured, verified challenge provider before enabling at scale. Disconnects/worker crashes need durable request expiration and idempotent refund. Avoid live payment changes. No unsupported file, image, web or voice controls are shown in this P0. Discovery starts disabled and never activates a module or transfers conversation contents.

No production data or providers will be changed until explicit approval for this implementation. Browser automation is disabled in local Work settings; manual device screenshots and interactive OAuth tests remain a documented staging acceptance step.
