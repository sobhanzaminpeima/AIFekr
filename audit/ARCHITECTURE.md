# AIFekr — Architecture Map
_Audit date: 2026-10-21_

## High-Level Architecture

```
Browser ──► Next.js App Router (single VPS, PM2)
               ├── /[locale]/* ──────── Multilingual landing pages (fa/en/de)
               ├── /(auth)/* ─────────── Login, Register, Verify OTP
               ├── /(dashboard)/* ────── Core SaaS modules (auth-gated)
               │     ├── chat, image, video, music, gallery
               │     ├── plans, referral, settings, startup
               │     └── (business)/ → crm, seo, social, ceo, voice-agent…
               ├── /admin/* ──────────── Admin panel (ADMIN/SUPER_ADMIN role)
               └── /api/* ─────────────── REST API endpoints
                     ├── auth/           JWT login/register/OTP/Google OAuth
                     ├── payment/        ZarinPal create+verify
                     ├── chat/           Streaming AI chat
                     ├── image/video/music/  AI generation
                     ├── crm/            CRM CRUD (workspace-scoped)
                     ├── seo/            SEO agent + GSC
                     ├── social/         Instagram OAuth + webhooks
                     ├── cron/           4 cron endpoints (secret-guarded)
                     ├── admin/          Admin CRUD (ADMIN role required)
                     └── voice-agent/    VAPI proxy + webhook
```

## Auth Flow

1. Email+password or Google OAuth → JWT cookie (`token`, httpOnly)
2. `requireAuth()` in each route handler: verifies JWT, loads user from DB, checks `isBlocked`
3. `requireAdmin()`: requireAuth + role check (ADMIN | SUPER_ADMIN)
4. Middleware: rate-limiting only (JWT decoded unverified for bucket key — intentional)
5. Session refresh: not implemented (JWT expiry = manual re-login)

## Payment Flow

```
User selects plan → POST /api/payment/create
  → prisma.payment create (PENDING)
  → ZarinPal request.json (or DEV bypass)
  → redirect to ZarinPal gateway

ZarinPal → GET /api/payment/verify?paymentId=&Authority=&Status=
  → verify with ZarinPal
  → activatePlanForPayment (transaction)
  → referral bonus (if first paid purchase)
  → email confirmation
  → redirect to /plans?payment=success
```

## AI Credit System

- Credits stored on `User.credits` (INT) or pooled on `Team.pooledCredits`
- Per-model costs configurable in `LlmModel` table (admin-managed)
- Deducted after successful generation
- **No atomic reservation** — concurrent overdraw is possible (P2-004)

## Multi-tenancy Model

- Single-tenant per User (`userId` foreign key on all resources)
- CRM: workspace abstraction via `crmWorkspace()` helper — supports team members acting under workspace owner's data with role restrictions
- Team plan: `Team` + `TeamMember` — pool credits, shared seat count

## Module Entitlement

- `User.plan`: FREE | PRO | BUSINESS | TEAM | AGENCY (from Package.planCode)
- `User.crmPlan`: NONE | SOLO | TEAM (add-on, separate purchase)
- `User.voicePlan`: NONE | ACTIVE (add-on)
- Plan expiry checked in UI (no server-side plan enforcement middleware found — relies on credit system)

## Key Dependencies

| Service | Purpose | Config |
|---|---|---|
| ZarinPal | Payments | `ZARINPAL_MERCHANT_ID` + DB override |
| Anthropic | AI chat/analysis | `ANTHROPIC_API_KEY` |
| OpenAI | Image generation | `OPENAI_API_KEY` |
| Fal.ai | Image/video | `FAL_KEY` |
| Replicate | AI generation | `REPLICATE_API_TOKEN` |
| VAPI | Voice calls | `VAPI_*` env vars |
| Instagram Graph API | Social automation | `META_APP_SECRET` |
| Google APIs | Search Console | `GOOGLE_*` env vars |
| AWS S3 / R2 | File storage | `STORAGE_*` env vars |
| Redis | Rate limiting (Upstash) | `UPSTASH_REDIS_*` |
