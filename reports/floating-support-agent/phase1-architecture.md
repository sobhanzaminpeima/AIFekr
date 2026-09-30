# Phase 1 — Shared Orchestrator Architecture (design only, no code)

**Master prompt:** AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md (v1.1) §1, §3.4, §5
**Date:** 2026-09-11 · **Model:** Opus 5
**Input:** Phase 0 discovery (`phase0-discovery.md`), approved.
**Settled by the user:** the current department-grouped sidebar is **final**. The Chat-Based UI
Restructure is not a prerequisite and is not assumed anywhere below.
**Status:** design document. No code written. Awaiting approval before Phase 2.

---

## 0. Executive answer to the question §3.4 asks

> *"Is Feature 2's Master Orchestrator the same engine Feature 1 uses, with reduced access?"*

**Yes — one engine, two modes — but the mode boundary is enforced by a server-side capability
allowlist, not by the system prompt.**

This distinction is the whole security argument. If `support_mode` were "the same orchestrator, told
in its prompt not to touch CRM", then a single successful prompt injection — from an Instagram
comment that reached a KB answer, or from a crafted user message — would turn the support widget
into a full data-access agent. Instead, `support_mode` is constructed with a tool table that
**contains no tenant-data tools at all**, and its context object **has no `workspaceUserId` field to
put one in**. A compromised model in `support_mode` cannot reach tenant data, because the code path
does not exist. The worst it can do is give wrong navigation advice.

---

## 1. Module layout

New directory, beside the existing agents — nothing in `src/lib/agents/` is modified:

```
src/lib/orchestrator/
  registry.ts     capability registry — the single source of truth (§2)
  modes.ts        mode definitions + tool allowlists (§3)
  isolation.ts    the workspace/tenant context builder (§4)
  routing.ts      intent resolution + conversation routing state (§5, §6)
  tools/
    kb.ts           support: knowledge-base retrieval
    nav.ts          support: navigation / "where is X"
    crm.ts          full: read + draft
    accounting.ts   full: read + draft (wraps financeAgent's proposal API)
    social.ts       full: read + draft only — never publish
    seo.ts          full: read
    strategy.ts     full: read (wraps businessSnapshot)
  guard.ts        untrusted-content framing + tool-arg validation (§7)
  run.ts          the turn lifecycle both modes share (§6)
```

**`src/lib/agents/ceoOrchestrator.ts` is not touched.** Phase 0 established it is a single-shot
report generator, not a router; §4 of the master prompt forbids changing its behaviour. The
orchestrator *reuses* `buildBusinessSnapshot()` and `buildCrmSnapshot()` as read tools.

---

## 2. The capability registry — one source of truth for both features

The root cause of "two features drifting into two knowledge bases" (§3.4's stated worry) is having
the feature list written down twice. So both features read **one** registry.

Design sketch:

```
interface Capability {
  key: string;                   // "crm", "accounting", "social.instagram", ...
  department: DepartmentKey | null;   // reuses src/lib/team/identity.ts
  href: string;                       // where the user goes
  planGate: "free" | "crm:SOLO" | "crm:TEAM" | "voice" | "plan:PRO" | ...
  label:  (lang: Lang) => string;
  blurb:  (lang: Lang) => string;     // one line: what it does
  docSlug: string;                    // → KB documents for this capability
  tools: ToolKey[];                   // which full_mode tools belong to it
}
```

Three consumers, one table:

| Consumer | Uses |
|---|---|
| Floating assistant (`support_mode`) | `label`, `blurb`, `href`, `planGate`, `docSlug` — answers "what is this / where is it / why can't I see it" |
| `/chat` orchestrator (`full_mode`) | `tools`, `department` — routes a message to the right domain |
| Phase 2 KB ingestion | `docSlug` — binds `docs/knowledge-base/<slug>.md` to a capability |

`planGate` is what makes the support assistant honest: when a FREE user asks "where are invoices?",
the truthful answer is *"under Finance → Accounting, but invoicing needs the CRM add-on"* — not a
link to a page that will 402. Phase 0 found the real gates already live in
`resolveCrmWorkspace()` / `hasCrmAccess()`; the registry mirrors them, it does not re-implement them.

---

## 3. The mode boundary — exactly where the line sits

### 3.1 Tool tiers

| Tier | Meaning | Executes | Example |
|---|---|---|---|
| `KB` | knowledge base + navigation, no tenant data | immediately | "where do I schedule an Instagram post?" |
| `READ` | reads tenant data, workspace-scoped | immediately | "how many new leads this week?" |
| `DRAFT` | writes only to a draft/proposal row a human must approve | immediately | "draft an invoice for customer X" |
| `COMMIT` | mutates live business data | **only** after a confirmation token (§3.3) | "change this deal's stage to Won" |
| `DENY` | never a tool, in any mode | never | publish to Instagram, change pricing, delete a contact |

### 3.2 Allowlist per mode

```
support_mode: { KB }
full_mode:    { KB, READ, DRAFT, COMMIT }
never:        { DENY }
```

`support_mode`'s context object is a different TypeScript type from `full_mode`'s. It carries
exactly four scalars — `lang`, `plan`, `crmPlan`, `currentPath` — and **no user id, no workspace
id, no Prisma client**. The four scalars are what the assistant needs to answer "why is this
greyed out for me" and "where am I right now"; none of them is tenant data.

When the user asks the Floating assistant something that needs real data ("how many leads do I
have?"), the correct behaviour is **not** to answer — it is to say so and hand over: *"I can't see
your data from here — your leads are in CRM,"* with a button to `/crm` and, on `/chat`, an offer to
ask the main chat instead. That is §2.4 of the master prompt, and it is also the only behaviour the
code makes possible.

### 3.3 The `DENY` list — operations that are never tools

These stay human-only. The orchestrator explains and links; it never acts:

- **Publishing to Instagram** (`POST /api/social/instagram/publish`) — locked decision, §4.
- **Any payment, pricing, plan, or credit change** — `/plans`, `/credits`, Zarinpal routes.
- **Deleting anything** — contacts, deals, invoices, conversations, generated media.
- **Team/user management** — inviting, removing, changing a member's `crmRole`.
- **Settings that change security or identity** — password, email, API tokens, connected accounts.
- **Admin surfaces** (`/admin/*`) entirely — even for an admin user. An admin's chat session is
  still a chat session; privilege escalation through a text box is exactly the risk.

Anything reachable only through a `DENY` route is answered as guidance plus a link.

### 3.4 COMMIT requires a two-turn confirmation, and the card is server-rendered

A `COMMIT` tool call never executes in the turn that proposes it. Instead:

1. The model proposes a tool call. The server **validates the arguments** against the tool's schema
   and the workspace (§4), then persists an `OrchestratorAction` row with `status: PENDING` and a
   short expiry.
2. The response stream carries an `<ACTION>` block containing **only the action id**.
3. The client renders a confirmation card by fetching that action — so the card's text is built from
   the *stored, validated arguments*, never from model-generated prose. A model that lies about what
   it is about to do cannot make the card lie.
4. The user clicks confirm. A separate `POST` executes the action, re-checking auth, workspace,
   plan gate, expiry, and `status === PENDING` (single-use).

`<ACTION>` follows the existing `<PROMPTBOX>` / `<SUGGESTIONS>` convention already parsed in
`ChatInterface.tsx` — no new streaming protocol.

---

## 4. Isolation model — what replaces "RLS" (§3.2)

Phase 0 established there is no RLS; isolation is application-level. Phase 1's job is to make that
non-bypassable for the orchestrator specifically. Three rules:

**Rule 1 — the orchestrator never sees a raw session user id.**
Every `full_mode` turn begins by building one context object:

```
interface WorkspaceContext {
  workspaceUserId: string;   // from resolveCrmWorkspace() — the OWNER, not the session user
  actingUserId: string;
  isAgentRestricted: boolean;
  crmPlan: string;
  plan: string;
  lang: Lang;
}
```

Tool functions accept `WorkspaceContext`, never a bare string id. A tool physically cannot query
"some other user" because it is not given one.

**Rule 2 — intra-tenant restriction is honoured, not just tenant isolation.**
This is the finding Phase 0 surfaced and the most likely way this feature introduces a real
vulnerability. `resolveCrmWorkspace()` returns `isAgentRestricted: true` for a team member with
`crmRole === "AGENT"` — such a user may see **only records assigned to them**, enforced by
`agentFilter(ws)` / `dealAgentFilter(ws)` in every CRM route today. An orchestrator that scoped only
by `workspaceUserId` would be a *correct-looking* tenant-isolated feature that nonetheless lets a
junior agent ask the chat "list every open deal" and receive the whole agency's pipeline.

Therefore: **every CRM/sales read tool spreads `agentFilter(ws)` into its where-clause**, and this
gets an explicit Phase 5 test of its own ("an AGENT asks the chat for all deals").

**Rule 3 — ids carried in conversation state are re-validated, never trusted.**
Routing state (§5) remembers entity ids across turns. Every tool re-queries with
`{ id, workspaceUserId: ctx.workspaceUserId }` and treats a miss as *not found*, so a stale id from a
workspace the user has since left resolves to nothing rather than to data.

**Plan gates are re-checked server-side per tool call**, using the same `hasCrmAccess(ws)` the routes
use. The chat is not a way around a paywall any more than it is a way around isolation.

---

## 5. Routing and cross-agent context — the data model

### 5.1 The problem

§1.1: one conversation where message 1 is about CRM and message 2 is about accounting, without
losing context. Two failure modes to avoid: (a) re-fetching every domain's data every turn (what
`ceoOrchestrator` does — expensive and slow); (b) letting raw history grow until context is lost.

### 5.2 Routing state — bounded, typed, re-validated

Per conversation, a small JSON blob rebuilt into the system prompt each turn:

```
interface RoutingState {
  lastDomain: string | null;        // sticky — "and what about that one?" stays in CRM
  entities: Array<{                 // max 8, LRU
    domain: string;                 // "crm" | "accounting" | ...
    kind: string;                   // "contact" | "deal" | "invoice" | "property"
    id: string;
    label: string;                  // display name, already sanitized
  }>;
  factsShown: Array<{ key: string; value: string; turn: number }>;  // max 12
}
```

Why a typed blob rather than "just keep the transcript": it is bounded (token cost stays flat as the
conversation grows), auditable (a reviewer can see exactly what the model was told), and — because
`entities` holds ids that get re-validated per Rule 3 — it cannot become a channel for stale or
cross-workspace references.

### 5.3 Schema additions (Prisma, SQLite)

Additive only; no existing column changes type or meaning.

| Model | Change | Purpose |
|---|---|---|
| `Conversation` | `+ mode String @default("chat")` | `"chat"` \| `"support"` — keeps Floating-widget threads out of the main `/chat` history sidebar |
| `Conversation` | `+ routingState String?` | the §5.2 JSON blob |
| `Message` | `+ agentKey String?` | which capability produced this answer → the §3.3 "based on your CRM data" label |
| `Message` | `+ sources String?` | JSON list of KB doc slugs cited, for support-mode answers |
| **new** `OrchestratorAction` | — | the §3.4 confirmation + audit record |
| **new** `KbDocument` | — | Phase 2: one doc-set row (slug, capability, lang, title, body, updatedAt) |
| **new** `KbChunk` | — | Phase 2: chunk text + `embedding String?` (JSON vector, the pattern already used by `BusinessMemory`) |

`OrchestratorAction` sketch: `id, conversationId, messageId, workspaceUserId, actingUserId, toolKey,
argsJson, status (PENDING|CONFIRMED|EXECUTED|REJECTED|EXPIRED|FAILED), resultJson, expiresAt,
confirmedAt, createdAt`. It doubles as the audit trail for "what did the AI actually do on my
account", which `AuditLog` does not currently cover for chat-initiated writes.

⚠️ **Deploy note carried from `PROJECT_CONTEXT.md`:** a `schema.prisma` change on this server needs
`npx prisma generate` after deploy, or every query touching the new columns throws at runtime while
the rest of the site looks healthy. This must be in the Phase 3/4 deploy checklist.

---

## 6. The turn lifecycle

Deliberately **not** built on model tool-calling: Phase 0 could not verify that the FreeLLMAPI
Mistral endpoint supports OpenAI-style function calling, and an architecture that depends on an
unverified capability is an architecture that gets rewritten in Phase 3. Instead, two structured
passes that work with any text model:

**`support_mode`** (Floating widget):
1. Resolve `lang` and `currentPath`.
2. Retrieve top-k KB chunks (Phase 2 RAG) + registry entries matching the query.
3. One LLM call: grounded answer + a navigation target chosen **from the registry**, not free-text.
4. Render answer + a real navigation button + cited doc slugs.

No classification pass, no tools, no data. One LLM call per message.

**`full_mode`** (`/chat`):
1. **Resolve intent — cheap first.** Sticky `lastDomain` plus a keyword pass (the existing
   `detectQueryType()` pattern in `router.ts`, extended per capability, already trilingual) settles
   the clear majority for free. Only genuinely ambiguous messages spend one small call on
   `ministral-3-8b` returning a strict JSON domain list. Multi-domain questions (§3.1's
   *"my leads this week, and prepare this week's Instagram post"*) return **several** domains.
2. **Plan** — one LLM call returns a strict JSON list of proposed tool calls.
3. **Gate** — server-side, before anything runs: each proposed call is checked against the mode
   allowlist, the `DENY` list, its argument schema, and the plan gate. `READ`/`DRAFT` execute now;
   `COMMIT` becomes a PENDING action; anything rejected is dropped and the model is told it was
   dropped, so it explains instead of pretending.
4. **Compose** — tool results are framed as untrusted data (§7) and one final call writes the
   user-facing answer, streamed through the existing SSE protocol.
5. **Persist** — update `RoutingState`, set `Message.agentKey`.

Cost per full_mode turn: 2 LLM calls typical, 3 when intent is ambiguous. The composition pass is
what makes several agents read as one voice (§3.1) — the user never sees the seams.

---

## 7. Prompt-injection defence (§4)

Untrusted sources reaching these prompts: CRM contact/deal free text (some of it auto-created from
Instagram DMs), Instagram comments, property descriptions, uploaded files, live web-search results.

**Layer 1 — framing.** All tool output is injected as `wrapUntrustedContent(label, body)`
(`src/lib/ai/promptSafety.ts`, already in use by `crmAgent`/`ceoOrchestrator`) and placed in a
*user-role* message, never in the system prompt. The system prompt is assembled from server
constants only — no interpolation of anything a user or a third party can influence.

**Layer 2 — heuristic.** `looksLikeInjectionAttempt()` gates free-text fields, as it does today.

> **Gap found, to be fixed in Phase 2:** `INJECTION_MARKERS` covers English and Persian only —
> there are **no German patterns**, despite German being a first-class platform language. A German
> injection (`"Ignoriere alle vorherigen Anweisungen"`) passes the heuristic untouched. The
> `wrapUntrustedContent` delimiter label is likewise hardcoded Persian regardless of conversation
> language. Both are small fixes and belong with the KB work.

**Layer 3 — the allowlist, which is the layer that actually holds.** Layers 1 and 2 are heuristics
and neither is complete. The real guarantee is architectural: a fully successful injection in
`support_mode` reaches a tool table with no data tools in it; in `full_mode` it reaches at most
`READ`/`DRAFT`, and any `COMMIT` still needs a human to click a card rendered from server-stored
arguments. **No injection path leads to a live mutation without a human click.**

**Layer 4 — the KB is admin-authored.** No user-supplied or scraped content is ever ingested into
the knowledge base, so retrieval cannot become an injection vector.

---

## 8. Model selection per mode

| Mode | Model | Why | Cost |
|---|---|---|---|
| `support_mode` | `mistral-medium-3.5` → `mistral-large-3` → Groq/Cohere free tier | RAG grounding + navigation, not deep reasoning. Free (§2.3 requirement). | **no new cost** |
| `full_mode` intent pass | `ministral-3-8b` | classification only | free |
| `full_mode` plan + compose | existing `/chat` routing (Claude primary, full fallback chain) | reasoning over real business data; `/chat` already charges credits for this today | **no change to existing economics** |

This satisfies §2.3 exactly: the *new* free-standing assistant adds no model cost, and `/chat` keeps
the model behaviour it already has. Per-plan model switching stays open — `selectProvider()` already
takes a `userPreferredModel`.

⚠️ **Still unverified from Phase 0:** whether `FREELLMAPI_API_KEY` is set in production. If it is
not, `getAvailableProviders()` filters all 13 free models out silently and `support_mode` falls
through to paid Claude — turning a free feature into a per-message cost with no error anywhere.
**Phase 3 must fail loudly at startup if `support_mode`'s configured model is unavailable**, rather
than silently falling back. This is a design requirement, not a nice-to-have.

---

## 9. UI contracts this architecture fixes now (details in Phase 3)

**z-index lanes.** Measured from the current code: `MobileNavShell` uses `z-40` (mobile top bar,
bottom tab bar, desktop floating control) and `z-50` (drawer + its backdrop); `ChatInterface`'s
template modal sits at `z-[300]`. The widget therefore takes:

| Element | Lane |
|---|---|
| Closed launcher button | `z-[200]` — above page content and the `z-40` bars, below the `z-50` mobile drawer |
| Open panel | `z-[210]` |
| Expanded/fullscreen panel | `z-[320]` — above the `z-[300]` modal |

**Mobile collision, decided now:** the mobile bottom tab bar is `fixed bottom-0 z-40` and full-width.
A launcher pinned to the bottom corner would sit on top of it. The launcher is therefore offset
above the tab bar's height on `<md`, and hides itself while the mobile drawer is open.

**RTL/LTR:** the widget anchors to the *inline-end* corner — bottom-left in RTL (fa), bottom-right in
LTR (en/de) — using the same `dir === "rtl"` logical-position pattern `MobileNavShell.tsx:114`
already uses, not hardcoded `left`/`right`.

**Identity:** `src/lib/team/identity.ts` establishes a locked convention — AI teammates get **role
names, never human names**, because "a human name on something that is not human buys a little
warmth and risks the trust the product is actually selling." The Floating assistant follows it: a
role name in all three languages, and a visual identity distinct from the four department colours
(sales `#ea580c`, marketing `#3b82f6`, finance `#1baf7a`, strategy `#a855f7`) — note `--primary` is
itself `#ea580c`, the same orange as Sales, so the widget must not simply use `--primary` or it will
read as "the sales department". Exact name and colour are a Phase 3 design decision.

**Source attribution (§3.3):** `Message.agentKey` renders as a small chip using the capability's
department colour — "based on your CRM data" — so the answer reads as one voice with a verifiable
origin, not as a stitched-together multi-agent transcript.

---

## 10. Explicitly not built

- No change to `ceoOrchestrator.ts`, `/ceo`, or the daily CEO cron.
- No change to the sidebar (confirmed final).
- No chat-based rebuild of image/video/music.
- No new database, no pgvector, no new AI provider, no new paid model.
- No feature removed — both features are additive (§4).

---

## 11. Open decisions I need from you before Phase 2

1. **Does the Floating assistant consume credits?** My recommendation: **no** — it runs on a free
   model and charging for "where do I find X?" punishes exactly the confused user it exists to help.
   It gets its own rate limit (~20/min/user) instead, reusing `rateLimit()`. *(Carried over from
   Phase 0 — still unanswered.)*
2. **Which layouts does the widget appear in?** Recommendation: **dashboard only** for Phase 3
   (`src/app/(dashboard)/layout.tsx`). Admin is on the `DENY` list anyway, and the public/marketing
   site has no session, no language cookie guarantee, and a different threat model — it deserves its
   own decision later, not a silent inclusion now. *(Carried over from Phase 0.)*
3. **Permission to SSH to `194.59.171.82`** to confirm `FREELLMAPI_API_KEY` is live (§8). Without it
   I am designing Phase 3 around models I cannot prove are reachable.
4. **Scope of `full_mode` for Phase 4.** The registry covers 11 capabilities. My recommendation is to
   ship Phase 4 with **CRM + Accounting + Social (draft-only) + Strategy-read** and add SEO, Lead
   Gen, Website Designer, Voice and Meeting in a later pass — four domains done properly, with real
   isolation tests, beats eleven done thinly. Tell me if you want all eleven at once.
