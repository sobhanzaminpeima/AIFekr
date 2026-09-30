# Phase 4 — `full_mode` orchestrator on `/chat`

**Master prompt:** AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md (v1.1) §3
**Date:** 2026-09-12 · **Model:** Opus 5
**Approved scope:** CRM + Accounting + Social (draft-only) + Strategy (read-only) — four domains done properly rather than eleven done thinly.
**Status:** built, and verified both by tests against the real database and by driving the real app in a browser. Awaiting approval before Phase 5.

---

## Before / after

| | Before | After |
|---|---|---|
| `/chat` | A single fixed persona prompt with no branching logic at all | Resolves business intent, reads the user's real data, and can act — within a server-enforced gate |
| Acting on business data from chat | Impossible | READ immediately · DRAFT to a human-approved queue · COMMIT only after an explicit confirmation · a DENY list that is never reachable |
| Ordinary chat | — | **Untouched.** No domain match ⇒ the pre-existing code path runs unchanged |
| Instagram publishing from chat | n/a | Structurally impossible — no publish tool exists, and drafts are hard-coded `mode: "manual"` so the publish cron cannot pick them up |
| Agent-role isolation in chat | n/a | Enforced with the same `agentFilter`/`dealAgentFilter` the CRM pages use, asserted by tests |

## What was built

```
src/lib/orchestrator/
  isolation.ts        WorkspaceContext — what replaces "RLS" here (3 rules)
  modes.ts            tier allowlists per mode + the never-build DENY list
  guard.ts            parse → gate → frame; nothing trusted from the model
  routing.ts          intent resolution + bounded cross-turn routing state
  run.ts              the turn lifecycle (intent → plan → gate → execute/stage)
  planner.ts          the planning call: free tier first, routed chain as fallback
  tools/{types,crm,accounting,social,strategy,index}.ts
src/app/api/orchestrator/action/[id]/route.ts   confirm (POST) / reject (DELETE) / read (GET)
src/components/chat/OrchestratorActionCard.tsx  the confirmation card
prisma/  OrchestratorAction model + Conversation.routingState + 2 migrations
```

Changed: `src/app/api/chat/route.ts` (additive pre-pass), `src/app/api/chat/history/route.ts`,
`src/components/chat/ChatInterface.tsx`, `src/lib/ai/providers.ts` (see bug 3 below).

## The five things that make this safe

**1. Tools are handed a context, never a user id.** Every tool takes a `WorkspaceContext`. It
cannot query another tenant because it is never given one.

**2. Intra-tenant restriction is honoured, not just tenant isolation.** This was the likeliest way
to introduce a real vulnerability: scoping only by `workspaceUserId` *looks* correct, but a team
member with the AGENT role would then be able to ask the chat to list every deal and get the whole
agency's pipeline — even though every CRM page correctly hides them. Measured in the test suite: the
agent's pipeline read returns **100** (their own deal) where the owner's returns **1000** (the
workspace total).

**3. The gate runs after the model speaks and before anything executes.** Deny list first, then
tier-in-mode, then plan gate, then the tool's own argument validator. A dropped call is reported to
the composing model so it explains rather than pretending.

**4. COMMIT is two-turn, and the card is server-authored.** The proposing turn only stores a
validated `OrchestratorAction`; the client receives an id, not text. The card is rendered from the
stored arguments, so a model that describes one change while requesting another cannot make the card
lie. Confirming re-checks auth, workspace, acting user, PENDING status, TTL, the gate, and the
validator — then runs the stored arguments.

**5. `support_mode` has no data tools at all.** Asserted by a test that loops the entire tool table
and requires every single entry to be unreachable in `support_mode`.

## Four real bugs found and fixed during this phase

**1. The deny list didn't match camelCase — so it blocked almost nothing.** `/\bpublish\b/` does not
match `social.publishPost`: in camelCase there is no word boundary between "publish" and "Post". The
list existed, read correctly, and let `social.publishPost`, `crm.deleteContact` and
`accounting.payInvoice` straight through. Found by my own test on first run. Fixed by normalizing a
key to space-separated words before matching, plus plural/inflected forms; the tests stay as the
regression guard.

**2. The COMMIT tier was unreachable — effectively dead code.** The tool required cuid ids, but a
single planning pass gives the model no way to obtain one (it proposes every call at once, before
seeing any result), and the prompt correctly forbids inventing ids. Verified live: asking "move the
DEMO Hilton renewal deal to the Won stage" produced *nothing staged*. Fixed by adding a `prepare()`
step to the tool contract: the model passes what the user said ("Hilton renewal", "Won") and the
server resolves it under the same scoping every read uses — refusing when the reference matches
nothing **or is ambiguous**, so a user with two "Hilton" deals is asked which, never guessed at.

**3. Two paid fallback providers were silently dead platform-wide.** `OpenAI GPT (Direct)` returned
HTTP 400 on *every* request: OpenAI renamed the parameter and now rejects the old name
("'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead"). Fixed,
scoped to `provider: "openai"` because every other OpenAI-*compatible* provider here still expects
`max_tokens`, and verified with a real call to the live API. This is the same failure mode as the
retired Groq model found in Phase 3 — two independent members of the fallback chain had quietly
stopped working, which only shows up on a day the primary provider is also down.

**4. Confirming a staged action would have failed every time.** The validator stripped the resolved
ids, so `run()` received no reference and returned `reference_not_resolved`. Caught by the
confirmation test suite; fixed so validation preserves and re-validates the resolved block (the ids
are still re-read under the workspace scope at execution).

Also fixed a UX gap found while testing: reloading the page lost the confirmation card while the
action stayed PENDING server-side for its full ten minutes — an answer saying "confirm this" with no
button anywhere. The history endpoint now returns still-pending actions and the client re-attaches
them.

## Verified live in the real app

Driving the running app as a real user with real CRM rows:

- **A pipeline question** returned genuinely real figures — 37 open deals, the real open value, real
  per-source conversion (organic 45 leads/13 conversions; Instagram 1/0) — and closed with "These
  figures come directly from your own account data." It correctly said win-rate and cycle time were
  not available rather than inventing them, because the snapshot returned null for both.
- **A COMMIT request** staged `PENDING` with a server-authored summary — `Move the deal "DEMO Hilton
  renewal" to the "Won" stage` — and **the deal stayed `open`**.
- **The card survived a full page reload** with working Confirm/Cancel buttons.
- **Confirming executed exactly once**: action → `EXECUTED`, the deal → `status: won`, correct stage,
  `wonAt` set, and the sibling "DEMO Riverside villa" deal untouched. The card then showed "Done".

Not verified live: the Instagram-deny path's final wording, because by then this dev machine's whole
provider chain was exhausted (FreeLLMAPI is VPS-only; Gemini hit its quota; OpenAI-direct was the bug
above). The orchestrator's *decision* on that path is covered by tests — the call is rejected, the
rejection text reaches the composing model, and `ScheduledPost` count is unchanged.

## Verification

- `npx tsc --noEmit` — 0 errors. `npx vitest run` — **28 files, 270 tests, all passing** (up from 202
  at the end of Phase 3). `npx next lint` on every new/changed file — clean.
- New test suites: `modes.test.ts` (19, the mode/deny/tier boundary), `guard.test.ts` (17, adversarial
  planner output), `isolation.test.ts` (11, real DB, cross- and intra-tenant), `run.test.ts` (14,
  full lifecycle), `confirmation.test.ts` (7, the confirm path's re-checks).
- Demo fixtures and this session's staged actions were cleaned out of the dev database afterwards.

## ⚠️ Deploy blocker found — in the *other* uncommitted work, not this

You asked me to deploy. I stopped, because the working tree cannot be deployed safely as it stands,
and this is worth a decision rather than a judgement call from me.

Deploys here are **tar-based** — `PROJECT_CONTEXT.md` §"Deploying to production": upload a tarball of
the tree, no git checkout on the server, migrations applied by hand. So a deploy ships *everything*
currently in the working directory, including the large body of unrelated uncommitted work
(lead-gen, credits, social brand-profile/competitors/quality, a public "1980s photo" feature).

That work has added to `prisma/schema.prisma` **with no migration file anywhere**:

- 6 new tables: `LeadForm`, `LeadFormSubmission`, `LeadSource`, `SocialBrandProfile`,
  `SocialCompetitor`, `SocialCompetitorSnapshot`
- 2 new columns: `ScheduledPost.qualityScore`, `ScheduledPost.qualityNotes`

Deploying that means `prisma generate` produces a client expecting columns production does not have.
Per the project's own "Deploy trap 2", every query touching those models then throws at runtime while
the rest of the site looks healthy. The most dangerous instance: **the Instagram publish cron selects
from `ScheduledPost`** — if the generated client selects `qualityScore`, that cron starts failing and
scheduled posts silently stop going out.

I have generated the missing SQL for you rather than applying it, since it is not my work to own:
`reports/floating-support-agent/PENDING-migration-for-other-work.sql`.

**Three ways forward — your call:**
1. **Deploy only this work.** Stash or branch the other changes, deploy, unstash. Cleanest, but
   someone has to be comfortable stashing in-progress work.
2. **Deploy everything.** Turn that SQL into a real migration, apply it on the server, deploy the
   lot — but that ships several features I have not reviewed and that nobody has QA'd here.
3. **Wait** until whoever is building the lead-gen/social work finishes and reviews it, then deploy
   together.

Whichever you pick, this work's own deploy steps are: apply
`prisma/migrations/20260912_orchestrator_action/` and
`prisma/migrations/20260912_conversation_routing_state/` (plus Phase 2's
`20260911_knowledge_base/`), run `npx prisma generate`, restart, then one
`POST /api/admin/kb/sync`.

## Carried forward

1. `FREELLMAPI_API_KEY` on production still unconfirmed (Phase 0/1/2/3 item) — the free planner falls
   back to the routed chain, so nothing is broken either way, but the intended primary is unverified.
2. Phase 5 (security testing) now has a substantial head start: cross-tenant, intra-tenant, deny-list,
   tier-gating and confirmation-flow cases are already written and passing. What Phase 5 still owes is
   prompt-injection testing from genuinely external content (an Instagram comment reaching a prompt)
   and the deliberate attempt to bypass Draft-and-Approve.
3. The other seven registry capabilities remain link-only by design.
