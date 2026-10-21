# AIFekr — Pre-Launch Audit Report
**Date:** 2026-08-16
**Scope:** Full 7-dimension sweep (startup-tester skill) after a large multi-agent session (credits fix, admin model management, currency localization, full German i18n, Voice Agent generalization + CRM link, WhatsApp/Telegram, CRM sidebar layout, notifications, custom image/video providers, KB file upload).

---

## 1. Codebase identity + confidence

**Single codebase confirmed**: Next.js 14.2 App Router + Prisma ORM + SQLite, at `C:\Claude Projects\AI Chat\ai-platform`. Per `.claude/PROJECT_CONTEXT.md` (2026-08-01 audit), the "dual-codebase" ambiguity referenced in the generic tester agent definitions does not apply here — JARVIS is a fully separate repo with no shared backend, not present in this checkout. All 7 subagents confirmed this and tested only this repo. Confidence: **High** — every subagent independently verified via direct file/schema reads, not assumption.

## 2. Drift findings (declared vs. actual)

| Known/assumed item | Actual state | Status |
|---|---|---|
| CEO Advisor / Meeting Room Persian-only | Fully i18n'd (UI + AI prompts) for fa/en this session | **Fixed** (de falls back to en — documented, intentional, see §4) |
| Industry Packs Persian in English mode | `nameEn`/`taglineEn`/`valuePropositionEn` etc. wired in | **Fixed** for fa/en (no `*De` fields yet — Minor) |
| Admin Dashboard "incomplete/broken" | `/admin/dashboard` renders real live data (stats, charts) from `/api/admin/stats`, no mock/placeholder found | **Appears fixed** — recommend founder re-confirm which specific admin page was originally meant |
| Assumed pricing model (Paddle, seat-based Agency billing, country-based gateway routing) | **Does not exist in this codebase.** Only Zarinpal (Iran) is wired; international (`market="INTL"`) plans have `price=0` and purchase is hard-blocked with a "contact us" message. Flat tiers only, no seat billing. | **Drift — spec/assumption doesn't match reality.** Treat the real model (Zarinpal-only, no self-serve international) as source of truth. |

## 3. Blocker summary (severity gate applied per constitution §1)

> Per the fixed rule: any finding touching tenant isolation, auto-send, the never-build list, or payment/webhook trust is automatically a Blocker regardless of the reporting agent's own label.

### 🔴 Blocker — Untrusted knowledge-base content reaches live customer calls unfiltered
**File:** `src/app/api/voice-agent/knowledge/upload/route.ts`, `src/app/api/webhooks/vapi/route.ts` (search_knowledge_base tool handler)
Uploaded PDF/DOCX text (and pasted-text entries) is stored in `VoiceKnowledgeBase.content` and returned **verbatim** as a Vapi tool-call result, which feeds directly into the live AI phone assistant's context on a real customer call. This codebase already has a standard defense for exactly this (`wrapUntrustedContent`/`looksLikeInjectionAttempt` in `src/lib/ai/promptSafety.ts`, used elsewhere e.g. the CRM/Sales agents) but it is **not applied here**. A malicious or compromised document could contain injected instructions that get spoken to a real customer on a real phone call.
**Verification:** Static (confirmed by direct code read).
**Fix:** wrap knowledge-base content with `wrapUntrustedContent()` before storing/returning it, and flag `looksLikeInjectionAttempt()` hits for review at upload time.

### 🔴 Blocker — Vapi webhook may accept unauthenticated requests
**File:** `src/app/api/webhooks/vapi/route.ts`
Signature verification only runs `if (VAPI_WEBHOOK_SECRET is set)`. If that env var is unset in production, anyone can POST forged call-end reports / tool-call payloads, including fabricated transcripts or CRM activity entries attributed to any tenant's `VoiceAgent`.
**Verification:** Manual-needed — **confirm `VAPI_WEBHOOK_SECRET` is actually set in the production `.env` right now.** If it is, downgrade this to resolved; if not, this is live and exploitable today.

### 🟠 Major (business-model gap, not a hard-gate Blocker, but flagged prominently per pricing dimension)
- **Voice Agent add-on has no self-serve purchase path** — `voicePlan` is only settable by an admin (`PATCH /api/admin/voice-agent/[userId]`). A business owner cannot buy this feature themselves today.
- **International customers cannot pay at all** — no Paddle/global gateway; `market="INTL"` plans are priced 0 and blocked from purchase, users get a "contact us" dead end.

## 4. Per-dimension findings (tagged by verification level)

### UI/UX — Static
- Drift-fix items (CEO/Meeting/Industry) confirmed fixed for fa/en. **Minor**: none of the three has German-specific content yet (Meeting Room agent names, CEO/Meeting AI system prompts, Industry Pack fields all fall back de→en) — intentional/documented, not a regression, but incomplete German rollout.
- **Polish**: `LanguageSwitcher.applyLang()` does a full page reload on every switch, dropping unsaved form state.
- New components (CRM sidebar, notification bell, KB upload widget, WhatsApp/Telegram buttons) are well-built: proper empty/loading/error states, RTL-safe logical CSS properties, i18n'd throughout.

### Code Quality — Executed + Static
- `npx tsc --noEmit` — **clean, 0 errors** (Executed).
- `npm run build` — **succeeds, all routes compile** (Executed).
- **Major (confirmed independently by 2 agents)**: `src/lib/ai/customProviders.ts:24-25` (`streamCustomProvider`) is missing the `row.type !== "chat"` guard that `customImageProvider.ts`/`customVideoProvider.ts` both have. An image/video-typed `CustomAiProvider` row can be invoked as a chat model via a hand-crafted `custom:<id>` request instead of being cleanly rejected.
- **Major (confirmed independently by 2 agents)**: `src/app/api/chat/route.ts` — the streaming call, message save, credit deduction, and usage-log write all share one try/catch. Since response chunks are already streamed to the client before the deduction/logging step runs, a transient DB error at that point is indistinguishable from a generation failure — user gets a full free response, no charge, no log, and a confusing "failed" message despite having a working answer. Manual-needed to confirm real-world frequency.

### Security — Static + Manual-needed (see Blockers above for the two most severe)
- **Medium**: `voice-agent/knowledge/upload` buffers the full multipart body (`req.formData()`) before checking the 10MB size cap — doesn't bound worst-case memory per request.
- **Medium (logical)**: chat/image/video credit pre-check is a separate read from the deduction write (not atomic) — a user firing concurrent requests could exceed their balance in narrow windows. Not unlimited free usage, just an overdraft race.
- **Low**: admin-configured custom-provider `baseUrl` has no SSRF/private-IP guard — mitigated by the fact this requires a trusted (or compromised) admin account.
- **Low**: Telegram deep-link username isn't URL-encoded (WhatsApp's is) — same-origin `window.open`, not exploitable as XSS, cosmetic/consistency issue.
- **Clean**: no Instagram auto-send regression, no missing-auth routes found among reviewed new endpoints, IDOR-safe fetch-then-check pattern confirmed on new CRM/voice routes, video-refund double-refund guard confirmed atomic and safe.

### Admin experience — Static
- Admin Dashboard renders real data — the previously-flagged "broken" issue is not reproducible from current code (recommend founder re-confirm scope).
- Vapi key management and custom-provider `type` selector both work correctly, including picking up keys inserted directly into the DB.
- **Gap**: no admin visibility for the new Notification system (can't monitor or broadcast) or the Sales Agent feature. No integrated voice/call view inside `/admin/crm` (exists only as a separate `/admin/voice-agent` page).

### User experience — Static (mostly Manual-needed to fully confirm rendering)
- Voice Agent's auto-provisioned phone number is never explained at the moment it matters — the "Connect phone number" button label is ambiguous and could make a non-technical owner think they need to enter their own number.
- WhatsApp ("compose then send") vs. Telegram ("just opens a blank chat, no pre-fill possible") behave differently despite matching visual weight — likely to confuse a user who tries WhatsApp first.
- CRM's new vertical sidebar has a good mobile fallback (horizontal scroll), but with 10 tabs and no fade/scroll affordance (unlike the pipeline board's own `BoardScrollRow`, which has one) — off-screen tabs on mobile are easy to miss.
- Language switcher: 1-click toggle became a 2-click dropdown — mild extra friction for the primary fa↔en use case, though the dropdown itself is clear once open.
- Sales Agent page: "Send Email" dead-ends with no alternate channel for leads without an email address, even though WhatsApp send now exists elsewhere in the CRM.
- Notification bell UX pattern itself is solid and familiar; whether all 3 wired notification types deep-link to the *specific* record (not just the general page) wasn't fully traced — Manual-needed.

### Pricing/business — Static (see Blockers/Majors above for the two biggest items)
- Chat credit pre-check uses a flat floor (1) while actual deduction scales 1–5 by provider — can let a low-balance user's request go through and land the balance negative.
- Custom **chat** providers are listed in the picker but silently ignored by the router (falls back to a built-in, still billed) — broken feature, not a free-usage leak.
- Video refund double-refund guard independently re-verified safe (atomic SQLite `UPDATE ... WHERE refunded=false`).
- Industry-pack currency localization (Rial/USD/EUR) confirmed display-only — does not touch the real Zarinpal charge path.

### Internal bug hunt — Static
- `matchCrmContactByPhone` has no deterministic tiebreaker when two `CrmContact` rows share a phone number — a call could attach to the wrong contact non-deterministically. **Minor.**
- `notify()` call sites (CRM lead, Vapi call-end, Instagram publish) all confirmed to pass a valid workspace-owner `userId` — no bug found.
- Full `prisma/schema.prisma` (1424 lines) read end-to-end — no duplicate fields, malformed relations, or merge artifacts from the many concurrent agent edits this session.
- Full `crm/page.tsx` (2378 lines) read end-to-end — no orphaned tab-bar-era code, no duplicate state, the new Voice Call Analytics sub-tab and WhatsApp/Telegram buttons are correctly wired into the current sidebar/state model, not leftover artifacts.

## 5. Cross-cutting patterns

The two most-repeated, independently-confirmed findings (`streamCustomProvider` missing type guard; chat credit deduction sharing a try/catch with generation) were each caught separately by **two different subagents** (code-quality + bug-hunter; code-quality + pricing) — high-confidence findings, not single-source noise.

Root cause behind several findings: this session ran many parallel agents each with narrow visibility into only their assigned slice of code. `customImageProvider.ts`/`customVideoProvider.ts` got a type guard because the agent that wrote them designed both together; `customProviders.ts` (chat) predates that pattern and nobody went back to backfill it. Same shape of gap explains the partial German coverage (three different pages/prompts each independently decided to fall back to English rather than being covered by one consistent policy).

## 6. Prioritized fix order

1. **Confirm `VAPI_WEBHOOK_SECRET` is set in production** (5-minute check, closes a Blocker if already true).
2. **Wrap Voice Agent knowledge-base content with `wrapUntrustedContent()`** before it can reach a live call (Blocker, contained fix).
3. **Add `row.type !== "chat"` guard to `streamCustomProvider`** (one-line fix, Major, matches existing pattern in the other two files).
4. **Fix chat credit deduction/logging to not share a catch block with generation failure**, and align the pre-check to the actually-selected provider's cost (Major, revenue + UX correctness).
5. Either wire custom chat providers into the router, or hide them from the picker until they are (Major, broken-feature cleanup).
6. Decide/communicate: is Voice Agent self-serve billing and international payment support coming, or intentionally admin/manual-only for now? (Business decision, not a code bug — but worth a deliberate answer before marketing either feature broadly.)
7. Everything else in §4 (Medium/Minor/Polish) — batch into a normal follow-up pass, not launch-blocking.

## 7. Manual-verification-needed checklist

- [ ] `VAPI_WEBHOOK_SECRET` actually set in production `.env`
- [ ] Live browser check: CRM sidebar + notification dropdown RTL rendering in fa
- [ ] Live browser check: Voice Agent KB drag-and-drop upload with a real PDF
- [ ] Confirm all 3 notification trigger types deep-link to the specific record, not just a general page
- [ ] Reproduce the chat credit-deduction silent-failure window under an injected transient DB error (dev only)
- [ ] Confirm whether the "Admin Dashboard broken" report was about `/admin/dashboard` specifically or a different admin page
