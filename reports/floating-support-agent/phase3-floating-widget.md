# Phase 3 — Floating support widget (support_mode)

**Master prompt:** AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md (v1.1) §2
**Date:** 2026-09-11 · **Model:** Sonnet 5 (as the master prompt recommends for Phase 3)
**Approved into this phase:** no credits charged; dashboard-only; the four `full_mode` domains from Phase 1 are deferred to Phase 4, unaffected by this phase.
**Status:** built and verified live against a real browser, a real dev database, and real model calls, in all three languages and at both mobile and desktop widths. Awaiting approval before Phase 4.

---

## Before / after

| | Before | After |
|---|---|---|
| In-platform help | None — a confused user had to guess or file a ticket | A floating assistant on every dashboard page, grounded on the Phase 2 knowledge base |
| Cost to the user | n/a | **Zero** — free-tier model only, own rate limit, no credit deduction |
| What happens if no free model is reachable | n/a | **Fails loudly** (503) rather than silently billing the user for Claude |
| Groq's fallback model (whole platform) | Silently dead — every real request 404'd | Fixed and verified with a real request |
| KB citations spanning multiple docs | n/a (Phase 2 didn't render them in a UI) | Disambiguated by document title, locale-correct separator |

## What was built

```
src/lib/orchestrator/support/
  identity.ts       role name + colour (teal, distinct from all 4 department hues and --primary)
  model.ts          free-tier-only model router — never falls through to a paid provider
  systemPrompt.ts   trilingual system prompt — answers in the platform's UI language, not the user's
  buildPrompt.ts     retrieval → context text + registry-based navigation target (pure, tested)
  formatSources.ts   citation formatting — deduped, title-disambiguated, locale-correct separator (pure, tested)
src/components/support/FloatingSupportWidget.tsx   the widget itself
src/app/api/support/chat/route.ts                  SSE chat endpoint (POST) + history (GET)
```

Changed: `src/lib/ai/router.ts` (exported `getEnabledProviders` for reuse), `src/lib/ai/providers.ts`
(Groq model fix — see below), `src/lib/rag/embeddings.ts` (carried from Phase 2's batching work),
`src/components/layout/MobileNavShell.tsx` (`MOBILE_DRAWER_EVENT`), `src/app/(dashboard)/layout.tsx`
(mounts the widget; excludes `tool: "support"` threads from the main chat sidebar),
`src/lib/orchestrator/kb/search.ts` (added `title` to `KbHit` for citations).

## Design decisions

**Reused `Conversation.tool`, not a new `mode` column.** Phase 1's design sketched a new
`Conversation.mode` field; while implementing I found `Conversation.tool` already exists and is the
exact established pattern for this (`"image"`, `"ceo"`, `"meeting"` already tag non-chat threads the
same way — see `src/app/api/image/chat/conversations/route.ts`). Used `tool: "support"` instead —
same effect, no schema change, matches the codebase's own convention rather than inventing a second one.

**No model tool-calling; navigation decided in code, not by the model.** The backend runs retrieval →
picks a navigation target from the registry (`pickNavigationTarget`) → hands the model grounded text
and asks only for the natural-language answer. The `<ACTION>`-tag idea from Phase 1 wasn't needed
here since `support_mode` has no `COMMIT` tier at all — there's nothing to confirm.

**SSE, not plain JSON.** Mirrors `/api/chat`'s exact streaming protocol (including the `reset`-on-fallback
contract) so the UX matches the platform's existing chat feel and the client-side parsing logic is a
direct, low-risk adaptation of `ChatInterface.tsx`'s own battle-tested loop.

**Identity:** teal (`#0891b2`), distinct from all four department colours and from `--primary` (itself
the sales department's orange) — per the locked convention in `src/lib/team/identity.ts`, a role name
("AIFekr Guide" / "راهنمای AIFekr" / "AIFekr-Guide"), never a human one.

**Hidden on `/chat`.** Mirrors an existing precedent exactly: `CommandPalette`'s own floating trigger
already hides there because it would sit "directly above that row and read as a redundant,
disconnected line" — a second floating helper bubble over the chat page's own composer is the same
collision.

**Mobile drawer coordination via a window event, not React context.** The dashboard layout that
parents both `MobileNavShell` and the widget is a server component — there's no client tree to share
state through for one boolean, so `MobileNavShell` dispatches `MOBILE_DRAWER_EVENT` on open/close and
the widget listens.

## Two real bugs found and fixed during live testing

Per the standing rule to measure the running app, not the source — both of these looked fine on paper
and only surfaced when I actually drove the widget with a browser against a real database and real
model APIs.

**1. Groq's entire free-tier model catalog had moved on — a platform-wide, pre-existing bug, not
introduced by this phase.** The first real request from the widget came back `SupportModelUnavailableError`.
Server logs showed every FreeLLMAPI variant failing with `fetch failed` (expected locally — that
aggregator is VPS-only) and then: `Groq ... error 404: "The model llama-3.3-70b-versatile does not
exist or you do not have access to it."` Checked Groq's live `/v1/models`: the entire Llama-3.x family
is gone from the account's catalog. This provider is Groq's role as the **last-resort fallback for the
whole platform** — main chat, CRM analysis, sales analysis, everything that goes through
`routedStreamChat` — so this had been a silent dead link platform-wide (only ever surfacing on days
every paid provider failed at once, which is presumably why nobody had noticed).

Fixed to `openai/gpt-oss-20b`, the closest match to the old model's "fast, general, last-resort" role
among Groq's current free catalog (`openai/gpt-oss-{20b,120b,safeguard-20b}`, `qwen/qwen3.{6,8}-27b`,
`groq/compound{,-mini}`, `allam-2-7b`). One nuance this surfaced: every current Groq free model is a
*reasoning* model that spends part of its token budget on an internal pass before the visible answer
(delivered as a separate `delta.reasoning` field the existing parser already ignores). Left at default
effort, a longer prompt can burn the whole `max_tokens` budget on reasoning and return no visible text
at all — measured directly (100 max_tokens, default effort: reasoning alone left too little room;
`reasoning_effort: "low"`: 5 reasoning tokens, full answer). Added that parameter, scoped to Groq only.
Verified: 10/10 real questions across fa/en/de answered correctly end-to-end using this exact model
after the fix (FreeLLMAPI unreachable from this dev machine by design, so every test genuinely
exercised the fallback path, not the happy path).

**2. KB citations collided across documents.** The first real answer (an accounting question) rendered
`Source: Where to find it, Where to find it, Where to find it` — every capability document has a
section with that exact heading, and `KbHit` only carried the bare heading. Fixed by adding the
document's own `title` to `KbHit` and formatting citations as `{title} — {heading}`, deduped. Caught a
second bug in the same fix: the sources line used a hardcoded Persian comma (`، `) regardless of UI
language — extracted `formatSources` as its own pure, unit-tested module with a locale table instead.

## Two things I investigated and ruled out as real bugs

- **A garbled user message during interactive testing** ("Where do I find invoiceWhere do I find
  invoices?s?") — turned out to be my own test action: a second click landed the cursor mid-text in an
  already-filled textarea and the new text was inserted there, which is correct, ordinary `<textarea>`
  behaviour. No code was involved. Reproduced cleanly with fresh input afterward — normal.
- **The Fullscreen toggle appeared not to respond to the browser tool's clicks** across several
  attempts. Verified via computed styles and a direct `element.click()` call that the state, CSS
  classes, `z-index`, and centered layout are all exactly correct (`w-3xl` capped, `mx-auto`/`my-auto`
  centering measured at the correct on-screen coordinates, backdrop at the right `z-index`) — the
  synthetic click events from the browser-automation tool were the flaky part, not the component.

## Verified live, in the browser, against real data

- **RTL (fa):** launcher and panel anchor bottom-**left**; header controls mirror (avatar/title right,
  close/expand left); navigation-button arrow points left; citation separator is `، `. Full round-trip
  on an Instagram-connection question retrieved four correct sections from `social.md`'s Persian block
  and produced a coherent, correctly-cited, RTL-correct answer.
- **LTR (en):** launcher/panel anchor bottom-right; a FREE/no-CRM-plan test user asking about invoices
  got an honest "Accounting isn't available on your current plan" answer with a working `/accounting`
  link and correctly formatted citations.
- **de:** full round-trip on "Wo finde ich Rechnungen?" answered entirely in German, correctly grounded,
  correct navigation button, citations joined with `, ` — confirms the "always answer in the platform's
  UI language" rule (not "mirror the user's language," which is what main chat does) actually holds.
- **Mobile (~375–614px real emulated widths):** launcher sits clear of the bottom tab bar; disappears
  completely — confirmed via DOM query, not just visually — the instant the mobile drawer opens; panel
  fits the viewport without overflow.
- **Desktop (1280px):** launcher/panel anchor correctly; Fullscreen expands to a backdrop-covered,
  precisely centered panel; Collapse returns to anchored mode; Close removes it entirely.
- **Plan-gate honesty:** capability reachability is computed server-side from `resolveCrmWorkspace()` +
  the registry, never asserted by the model — confirmed the assistant told a real FREE-tier test user
  the truth about what needs an upgrade, twice, in two languages.

## Verification

- `npx tsc --noEmit` — 0 errors. `npx vitest run` — **23 files, 202 tests, all passing** (up from 188 at
  the end of Phase 2). `npx next lint` on every new/changed file — clean.
- Full end-to-end browser verification as above, including a full dev-server restart and a `.next`
  cache wipe partway through to rule out a stale-compile red herring (documented, ruled out — the
  actual file was correct throughout; a lingering webpack error overlay had cached an already-fixed
  error).
- Per the project's own `aifekr-business-impact-simulator` schedule (a real feature shipped + a real
  bug fixed): re-ran it. **Automation-maturity score unchanged at 52/100** — an honest result, not an
  oversight: this widget doesn't automate any of the five scored business functions (it helps the
  *AIFekr user* use the platform, not their downstream customers or business operations), so crediting
  it there would inflate the number. Full report:
  [reports/business-impact/2026-09-11-phase3-floating-widget.md](../business-impact/2026-09-11-phase3-floating-widget.md).

## A note on the repository's current state

While checking `git status` before writing this report, I found substantial **unrelated, uncommitted
work already in this repository** — lead-gen connectors, a credits/pricing system, social
brand-profile/competitor/quality tooling, a "1980s photo" public feature, and others — plus, notably,
`analysis/floating-assistant-phase0-discovery.md`: an **independent Phase-0-style discovery document
for this exact master prompt**, dated today, written differently from mine. This strongly suggests
another session has been working the same master prompt concurrently (possibly explaining some
browser-automation flakiness I hit and worked around during testing — see above). I have not touched,
staged, or committed any of that other work. Worth knowing before anyone commits broadly.

## Carried forward to Phase 4

1. `FREELLMAPI_API_KEY` on production is still unconfirmed (Phase 0/1/2 item). Not blocking — Groq now
   works as a genuine fallback either way — but the intended primary free model still needs SSH access
   to verify.
2. No admin UI button for the KB sync yet (API-only, from Phase 2) — a UI change belongs with its own
   trilingual/mobile check rather than being slipped into this phase.
3. The independent `analysis/floating-assistant-phase0-discovery.md` found above — worth reconciling
   with the user before Phase 4, in case it reflects decisions from a parallel session that should
   inform (or that conflict with) this one.
