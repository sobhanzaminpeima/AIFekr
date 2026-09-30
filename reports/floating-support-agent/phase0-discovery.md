# Phase 0 — Discovery & Mapping

**Master prompt:** AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md (v1.1)
**Date:** 2026-09-11 · **Model:** Opus 5 (as the prompt requires for Phase 0/1)
**Status:** Discovery only — no code written. Awaiting approval before Phase 1.

---

## 1. Which codebase is live

**Live = this repo.** `C:\Claude Projects\AI Chat\ai-platform` → aifekr.com, VPS `194.59.171.82`
(`/var/www/ai-platform`, PM2 `ai-platform` + nginx). Verified: `https://aifekr.com/` returns 200.

There is **no "version A / version B legacy" dual codebase** as the master prompt's §1.1 assumes.
That framing came from a `context/project-context.md` that **does not exist in this repo**. The real
file is `.claude/PROJECT_CONTEXT.md`, and it explicitly records that an earlier version of itself
described an *aspirational* architecture that did not match what was deployed.

## 2. Four assumptions in the master prompt that are wrong for this codebase

| § | Prompt assumes | Reality in code |
|---|---|---|
| 3.2, 4 | "Full RLS on all Supabase tables, no exceptions" | **No Supabase, no Postgres, no RLS.** AIFekr is **Prisma + SQLite**. Isolation is enforced in application code: `requireAuth()` (`src/lib/auth/middleware.ts`) plus an explicit `userId` (or team) filter on every query. |
| 2.2 | "Build the KB on pgvector, already implemented in JARVIS per stack version A" | pgvector exists **only in the JARVIS repo** (separate Postgres + FastAPI). AIFekr and JARVIS share **zero** backend — the only link is a stateless JWT SSO bridge (`/api/jarvis-sso`). AIFekr cannot query JARVIS's pgvector. |
| 1.2 | "If the Chat-Based UI Restructure prompt has been executed, build inside it" | **It has not been executed.** The sidebar is still the department-grouped 11-destination one from Design Director phase 2 (commit `fdd30bd`). `/image/generate`, `/video/generate`, `/music/generate` are still separate form pages, not chat surfaces. |
| 1.3 | "Read `AIfekr_CRM_Accounting_MasterPrompt.md` and `_Module_Spec.md`" | Neither file exists — not in the repo, not in Downloads. CRM and Accounting **are built** (~30 `Crm*` Prisma models, 19 accounting API groups), so the mapping below is taken from the code. |

**Consequence:** §3.2's "RLS" requirement translates to *"every orchestrator data call goes through
`requireAuth()` and is scoped by `userId`, exactly like every other route — no service-level
credential, no bypass"*. The security intent is unchanged; the mechanism is different. §2.2's
pgvector requirement is already solved differently — see §5.

## 3. Real inventory of agents and features (from code, not docs)

**Business departments** (11 destinations, `src/components/layout/Sidebar.tsx` + `/agents`):

| Department | Feature | Route | Backing agent module |
|---|---|---|---|
| Sales | CRM | `/crm` | `agents/crmAgent.ts`, `crmSnapshot.ts` |
| Sales | Sales Agent | `/sales` | `agents/salesAgent.ts`, `salesFollowUp.ts`, `leadMatcher.ts` |
| Sales | Voice Agent | `/voice-agent` | `lib/voice/*`, Vapi webhook, `VoiceKnowledgeBase` |
| Sales | Industry Packs | `/industry` | `lib/industry` |
| Marketing | Social Media (Instagram) | `/social` | `lib/instagram.ts`, `api/social/instagram/*` |
| Marketing | Lead Gen | `/lead-gen` | `lib/leadgen` |
| Marketing | SEO Workspace + agent pipeline | `/seo` | `agents/seoAudit.ts`, `contentPipeline.ts` (8-agent) |
| Marketing | Website Designer | `/website-designer` | `GeneratedWebsite` |
| Finance | Accounting (10 sub-pages) | `/accounting` | `agents/financeAgent.ts`, `lib/accounting` |
| Strategy | CEO Advisor + Orchestrator | `/ceo`, `/ceo/orchestrator` | `agents/ceoOrchestrator.ts`, `businessSnapshot.ts` |
| Strategy | Business Doctor | `/business-doctor` | `BusinessAnalysis` |
| Strategy | AI Meeting Room | `/meeting` | `BoardroomSession` |

**Create / content:** General Chat `/chat`, Image `/image/generate` (+ Character Creator, gallery),
Video `/video/generate`, Music `/music/generate`, My Agents `/agents`, Startup Builder `/startup/builder`.
**Account:** Home, Credits, Plans, Referral/Wallet, Settings. **Tools:** 6 (`/tools/*`).
**Assistants:** 7 persona chats (`/assistants/[type]`). **Admin:** 34 pages. **Total API routes: 305.**

This is the spine of the Floating assistant's knowledge base.

## 4. Is `ceoOrchestrator.ts` the Master Orchestrator Feature 2 needs? — No

218 lines. It is a **single-shot report generator**, not a router:
`buildBusinessSnapshot(userId)` pulls a *fixed* slice of every domain → one hardcoded prompt →
one streamed Markdown report (situation summary / priorities / draft follow-ups / decisions) →
persists 2–4 memory lines. There is **no** intent classification, **no** per-agent dispatch,
**no** tool/function calling, **no** multi-turn context, and it always reads everything regardless
of what was asked.

**But it is valuable anyway:** `businessSnapshot.ts` and `crmSnapshot.ts` are a ready-made,
already-`userId`-scoped **read-only data layer** that `full_mode` can consume on day one. Verdict:
**do not modify `ceoOrchestrator.ts`** (§4 forbids breaking its current behaviour); build the
orchestrator as a new module beside it and reuse the snapshot builders.

## 5. RAG — pgvector is not needed; the pattern already exists and works

`src/lib/rag/` is already in production:

- `embeddings.ts` — Cohere **`embed-multilingual-v3.0`**, which puts Persian, English and German in
  the **same vector space** (exactly what §2.2 needs), via `COHERE_API_KEY` and an optional relay
  for the sanctioned-IP server. Returns `null` on any failure, never throws.
- `retrieve.ts` — `rankByRelevance()` re-ranks a recency-capped candidate window by cosine
  similarity in JS, with graceful fallback to recency when embeddings are unavailable.
- Vectors are stored as **JSON strings in SQLite TEXT columns** — already live on
  `BusinessMemory.embedding`, `ContentAgentLesson.embedding`, `CrmInsight.embedding`.

For a knowledge base of ~100–200 doc chunks this is entirely adequate (a full scan of 200 × 1024
floats is sub-millisecond). **No new database, no pgvector, no new dependency.**
Precedent for editable doc-sets already exists too: `VoiceKnowledgeBase` (title + content rows,
fed by a file-upload route) is how the Voice Agent's KB works today.

## 6. Free models available for the Floating assistant (§2.3) — yes, no new cost

`src/lib/ai/providers.ts` registers a self-hosted **FreeLLMAPI** aggregator
(`http://127.0.0.1:3001/v1`, localhost-only, Docker on the same VPS) exposing **13 Mistral-family
models**, all `creditCost: 1`, all verified with real requests on 2026-08-28:

- General/reasoning: `mistral-large-3`, `mistral-medium-3.5`, `mistral-small-4`,
  `magistral-medium`, `magistral-small`, `ministral-14b`, `ministral-3-8b`
- Code: `codestral`, `devstral`, `devstral-medium`, `mistral-code`, `mistral-code-agent`,
  `mistral-vibe-cli-fast`

**Recommendation: `mistral-medium-3.5` primary, `mistral-large-3` fallback.** Mistral models are
genuinely strong in German/English and adequate in Persian; the task is RAG grounding plus
navigation, not deep reasoning, so this is the right tier. Also available as free-tier last resorts:
Groq (Llama 3.3 70B) and Cohere (Command R7B). **No paid model needs to be added.**

Per-tenant/per-plan model switching (§2.3.4) is trivial to leave open: `selectProvider()` already
accepts a `userPreferredModel` matched against `Provider.model`.

⚠️ **One item I could not verify:** whether `FREELLMAPI_API_KEY` is actually set on the production
server right now. It is absent from the local `.env.local` (so free models are unavailable locally),
and `getAvailableProviders()` filters out any provider whose key is shorter than 10 chars — meaning
if the key is missing in production, **all 13 free models silently disappear** and routing falls
through to paid Claude. My attempt to SSH to `194.59.171.82` and check was blocked by the permission
classifier. This must be confirmed before Phase 3 commits to a free model.

## 7. Security groundwork that already exists (good news for §3.2 / §4)

- **Draft-and-Approve is already a real pattern, not just an Instagram rule.** `financeAgent.ts`
  implements `proposeJournalEntry()` / `proposeExpenseCategorization()` / `listProposals()` /
  `approveProposal()` / `rejectProposal()` — a persisted proposal that a human approves. This is the
  exact shape `full_mode`'s confirmation step should reuse rather than invent.
- **Instagram publishing already requires an explicit human act.** `POST /api/social/instagram/publish`
  takes a `postId` of an already-drafted `ScheduledPost` and is scoped `{ id, userId }`. The chat
  orchestrator must be given **no tool that reaches this route** — drafting only.
- **Untrusted external text is already sanitized.** `crmAgent.ts` exports `sanitizeFreeText()`, used
  before contact free text enters any prompt (`ceoOrchestrator.ts` already calls it). This is the
  hook for the §4 prompt-injection rule on Instagram comments/DMs.
- **`promptSafety.ts`** exists in `src/lib/ai/` with tests.

## 8. UI landscape for the Floating widget

- **No floating widget exists today** — the only fixed-position chrome is `MobileNavShell.tsx`.
  Nothing to collide with; a z-index map still needs writing in Phase 1.
- Mount point is `src/app/(dashboard)/layout.tsx` (wraps every dashboard page, already resolves
  `lang` server-side via `getServerLang()`). Admin (`src/app/admin/*`) and public/marketing pages are
  separate layouts — a decision is needed on whether the widget appears there too.
- i18n is `fa/en/de` via `src/lib/i18n/{fa,en,de}.ts` plus the `tri(lang, fa, en, de)` helper.
  RTL/LTR is driven off `lang`.
- `/chat` is `<ChatInterface />` — a single 1,537-line client component. Feature 2 lands inside it.
  It already renders typed blocks (`<PROMPTBOX>`, `<SUGGESTIONS>`, media turns), so a typed
  "confirmation card" block for sensitive operations fits the existing parsing convention.
- `POST /api/chat` charges credits per message (`getAvailableCredits` / `deductCredits`) and
  rate-limits 30/min/user.

## 9. Open questions blocking Phase 1

1. **Sidebar contradiction.** Design Director shipped an 11-destination department sidebar; the
   Chat-Based UI Restructure prompt asks for a 4-item minimal one. That prompt itself says to stop
   and ask when this contradiction appears. Which is final? It decides whether the Floating widget
   is primarily a navigation aid for a dense sidebar, or something else.
2. **Order of work.** Should the Chat-Based UI Restructure run *before* this prompt? Feature 2 lands
   inside `/chat`'s UI, and restructuring that UI afterwards would mean doing the work twice.
3. **Does the Floating assistant consume user credits?** It is a support tool; charging credits for
   "where do I find X?" would be hostile. Recommendation: free, with its own rate limit.
4. **Scope of "all pages"** — dashboard only, or also admin pages and the public/marketing site
   (where the visitor has no session and therefore no tenant data at all)?
5. **Confirm `FREELLMAPI_API_KEY` is live in production** (see §6) — or grant SSH permission to check.
