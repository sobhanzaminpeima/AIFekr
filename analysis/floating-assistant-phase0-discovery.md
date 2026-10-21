# Floating Support Assistant + Unified Chat Orchestrator — Phase 0 discovery

**Date:** 11 September 2026
**Source doc:** `AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md` v1.1
**Method:** read of the running codebase only — no assumptions carried over from the master prompt's own description of the stack.

This phase exists specifically to catch mismatches between what the master prompt assumes and what the repo actually is, before any design work. Three assumptions in the source doc do not match this codebase. Flagging them now, per the doc's own Phase 0 instruction ("اگر نامشخص، متوقف شو و بپرس" / stop and ask if unclear) — the answer here isn't unclear, it's just different from the prompt's premise, so this report corrects it rather than stopping.

---

## 1. Which codebase is live — corrects the doc's premise

The master prompt asks me to determine "کدام کدبیس الان لایو است" between "نسخه A جدید" and "نسخه B legacy", per a `context/project-context.md` that doesn't exist at that path. The real project context (`.claude/PROJECT_CONTEXT.md`) already settled this in an earlier audit:

- **One live codebase**: AIFekr — Next.js 14.2 App Router, Prisma ORM, **SQLite** (not Postgres/Supabase), single VPS, PM2 + nginx.
- **JARVIS** (`C:\Claude Projects\AI Chat\jarvis`) is a **fully separate repo, separate app, separate database** (self-hosted Postgres+pgvector, Turborepo/pnpm, FastAPI). The only link between the two is a stateless JWT SSO bridge (`/api/jarvis-sso`) — **zero shared backend, zero shared database, zero shared memory/cache**.

Both features in this master prompt (the floating widget and the `/chat` orchestrator) live on **aifekr.com**, i.e. entirely inside the AIFekr repo. JARVIS is not part of this work.

## 2. Two more premise corrections that change the design

### a) No Supabase, no RLS layer
Section 3.2 and the "غیرقابل‌مذاکره" list require "RLS کامل روی همه جداول Supabase". **This project has no Supabase and no Postgres row-level-security layer.** Tenant isolation here is the pattern already used by every existing module: every Prisma query is explicitly scoped by `userId` from the authenticated session (`requireAuth()` in `src/lib/auth/middleware.ts`), with a couple of modules (CRM) adding an extra `resolveCrmWorkspace()` step for team-member role restriction (`src/lib/crm/workspace.ts`). Whatever the Master Orchestrator becomes, its isolation guarantee has to be **"every tool call is scoped with the same `userId` the rest of the app uses, never a broader query"** — functionally the same goal as the master prompt's RLS requirement, just enforced in application code instead of the database.

### b) No pgvector — RAG here is a lightweight in-app cosine ranker
Section 2.2 assumes "pgvector (که طبق نسخه A استک پروژه از قبل در JARVIS پیاده‌سازی شده)" is available to reuse. It is — **in JARVIS's own Postgres**, which AIFekr cannot query (no shared database, confirmed above). AIFekr's own existing RAG (`src/lib/rag/embeddings.ts`, `src/lib/rag/retrieve.ts`) is:
- Embeddings via **Cohere's multilingual model** (`embed-multilingual-v3.0`, handles fa/en/de in one vector space), reached through the same `AI_RELAY_BASE_URL` relay every network-blocked provider uses.
- Stored as a **JSON-stringified float array in a plain SQLite text column** — no vector index.
- Ranking is **brute-force cosine similarity in Node**, over a candidate set the caller has already capped by recency (e.g. last 30-60 rows) — `rankByRelevance()` in `retrieve.ts`.
- Falls back to plain recency ordering whenever Cohere is unreachable or a row has no embedding — never throws.

This is real and working (already used by `BusinessMemory` for CEO Orchestrator and the SEO pipeline), but it's sized for tens of rows per query, not a large indexed corpus. A knowledge base of on the order of **50-150 short articles** (one per feature/how-to) is comfortably inside what this can rank well; if the doc-set grows far beyond that, the retrieval step will need a pre-filter (e.g. category/keyword narrowing before the cosine pass) rather than a full pgvector migration — flagged for Phase 2 design, not a blocker now.

## 3. Full feature/agent inventory (from the real routes, not documentation)

| Area | Route | Notes |
|---|---|---|
| CRM | `/crm` | Pipeline, contacts, deals, invoices, contracts, documents, automation, property module, AI agent (`crmAgent.ts`) |
| Accounting | `/accounting` | Ledger, invoices, owner statements, commission records |
| Business Doctor | `/business-doctor` | Business profile + AI SWOT analysis, saved as `BusinessAnalysis` |
| Sales Agent | `/sales` | |
| Voice Agent | `/voice-agent` | AI call center (Vapi) |
| Social Media | `/social` | Instagram connect/publish/schedule, comment→DM campaigns, growth analytics (just extended this session), brand profile, content quality scoring |
| Lead Generation | `/lead-gen` | Tenant-facing lead capture forms + Meta/Google ad connectors (built this session) |
| SEO | `/seo` | Content pipeline, agent lessons |
| Website Designer | `/website-designer` | |
| CEO Orchestrator | `/ceo` | See §4 — periodic briefing, not a live router |
| AI Meeting | `/meeting` | Multi-agent roundtable |
| Industry Packs | `/industry` | Per-industry agent bundles (8 packs) |
| Image / Video / Music generation | tabs on `/chat` composer | |
| Startup Builder | `/startup/builder` | |
| Generic tools | `/tools/*` | Business ideas, trading, math, diet, dropshipping, "try free AI" |
| Assistants | `/assistants/*` | Teacher, doctor, translator, chef, fitness coach, travel agent, code expert |
| Main chat | `/chat` | Plain assistant chat today — **no intent routing to any of the above** (confirmed in §4) |

No existing floating widget of any kind was found (`fixed bottom-*` hits were only the chat composer and the desktop command-palette trigger, both unrelated).

## 4. How close is `ceoOrchestrator.ts` to the Master Orchestrator feature 2 needs?

**Not close — it solves a different problem.** Read in full (218 lines):

- It is invoked **on demand or by a daily cron**, not per chat message.
- It calls `buildBusinessSnapshot(userId)` (`src/lib/agents/businessSnapshot.ts`), which does **one big read-only aggregation** across CRM, content, social, revenue, usage, and shared `BusinessMemory` — all already `userId`-scoped.
- It sends that whole snapshot to the LLM **once** and asks for a **single fixed-structure Markdown report** (situation summary, priorities, draft follow-up messages, a dev-facing provider-stability note, decisions) — never a back-and-forth conversation, never a tool call, never a write.
- It has no concept of "route this message to the CRM agent vs. the accounting agent" — there is no message-level intent classification anywhere in the codebase. `/api/chat/route.ts` (277 lines) is a single fixed marketing-persona system prompt with no branching logic at all.

**What is reusable:** `buildBusinessSnapshot()` / `buildCrmSnapshot()` are good read-side building blocks — a `support_mode` or read-only part of `full_mode` could call the same aggregators. **What is not reusable:** there is no per-message router to extend; the Master Orchestrator (intent detection, per-domain tool dispatch, multi-turn context across domains, the write-path confirmation flow) is a **new component**, not a refactor of `ceoOrchestrator.ts`.

## 5. Free-model inventory (`src/lib/ai/providers.ts`) for the floating assistant's model

| id | model | strengths | notes |
|---|---|---|---|
| `free-mistral-large-3` | mistral-large-3 | general, business, reasoning, complex | Best-quality of the free tier |
| `free-mistral-medium-3-5` | mistral-medium-3.5 | general, business, reasoning | |
| `free-mistral-small-4` | mistral-small-4 | general, fast | |
| `free-magistral-medium` / `-small` | magistral-* | reasoning, math | |
| `free-ministral-14b` / `-3-8b` | ministral-* | general, fast | |
| `free-codestral`, `free-devstral*`, `free-mistral-code*` | — | code, technical | not relevant here |
| `groq` (Llama 3.3 70B) | — | free tier, already used as a fallback in the main router | |

All route through `FREELLMAPI_BASE_URL` (self-hosted aggregator, Docker, localhost-only) or the Groq relay — no new billing account needed. **Recommendation for Phase 2/3 (pending your approval, not decided here):** `free-mistral-large-3` for support_mode — it's tagged "business" and "reasoning" and is the largest free-tier model already wired in, which matters for RAG-grounded, three-language navigation help. No paid model is proposed; if quality testing in Phase 2 shows it's insufficient, that will be reported explicitly with evidence, per the master prompt's own rule (§2.3.3), not decided unilaterally.

---

## Executive summary

1. **Live codebase confirmed:** AIFekr only (Next 14.2/Prisma/SQLite). JARVIS is unrelated — separate repo, separate database, no shared backend.
2. **Two premises in the master prompt don't match this stack** and are corrected above: no Supabase/RLS (isolation is `userId`-scoped app code, same pattern as every existing module) and no pgvector (AIFekr's real RAG is Cohere embeddings + in-app cosine ranking over capped SQLite rows — real, working, fine for a ~50-150-article knowledge base).
3. **Full real feature list built** from the actual route tree (§3) — this becomes the floating assistant's knowledge-base source list.
4. **`ceoOrchestrator.ts` is not a router** — it's a periodic one-shot briefing generator. Its data aggregators (`buildBusinessSnapshot`, `buildCrmSnapshot`) are reusable; the Master Orchestrator's per-message routing/dispatch logic is a new build.
5. **Free-model shortlist identified**, no new billing proposed.

**Awaiting your approval before Phase 1** (shared Orchestrator architecture — `support_mode` / `full_mode` boundary, design doc only, no code).
