# Phase 2 — RAG knowledge base

**Master prompt:** AIfekr_FloatingSupportAgent_UnifiedChat_MasterPrompt_1.md (v1.1) §2.2, §5
**Date:** 2026-09-11 · **Model:** Opus 5
**Approved into this phase:** current sidebar is final; the floating assistant costs no credits;
dashboard-only; `full_mode` scoped to CRM + Accounting + Social (draft-only) + Strategy (read-only).
**Status:** built and measured against the real dev database and the real Cohere API.
Awaiting approval before Phase 3.

---

## Before / after

| | Before | After |
|---|---|---|
| Platform feature list | Written down in the sidebar, `/agents`, and nowhere machine-readable | One registry, `src/lib/orchestrator/registry.ts`, read by the assistant, the router, and KB ingestion |
| Support knowledge | None | 17 documents × fa/en/de = **51 documents, 222 chunks, 222 embedded** (1024-dim) |
| Updating the docs | n/a | Edit markdown → one admin POST. Measured: a one-line edit re-embedded **3 chunks, not 222** |
| Full re-index cost | n/a | **4.9s** (was 49s and silently incomplete — see below) |
| German prompt-injection heuristic | Absent — English + Persian only | Six German patterns added, with tests |

## What was built

```
src/lib/orchestrator/
  registry.ts            24 capabilities: label/blurb/href/planGate/docSlug/tool tiers (fa/en/de)
  kb/parse.ts            trilingual markdown → chunks (pure, unit-tested)
  kb/ingest.ts           two-pass incremental sync with batched embeddings
  kb/search.ts           hybrid retrieval: cosine + keyword, degrades to keyword-only
  kb/parse.test.ts       parser + guards over the shipped doc-set itself
  kb/search.test.ts      tokenizer across fa/en/de
docs/knowledge-base/     17 documents + README (the format guide for whoever edits them)
src/app/api/admin/kb/sync/route.ts   POST to re-index (?force=1), GET to inspect the index
prisma/                  KbDocument + KbChunk, plus migration 20260911_knowledge_base
```

Changed: `src/lib/rag/embeddings.ts` (batch API), `src/lib/ai/promptSafety.ts` (German patterns,
trilingual delimiter), `.gitignore` (see below).

## The three decisions §2.2 asked for

**1. Where the doc-set lives — `docs/knowledge-base/*.md`, in the repo.**
Plain markdown, reviewable in a diff like any other change, shipped by the existing tar deploy, read
from `process.cwd()` at sync time — the same pattern `src/lib/ai/router.ts` already uses for
`provider-config.json`. No CMS to run, no second system to keep alive.

All three languages live **in the same file**, split by `<!--lang:fa-->` markers. That is the one
non-obvious choice here and it is deliberate: this project has a documented history of German going
quietly stale (commit `e24f208`, "five agents dropped German on the floor"). Someone editing the
Persian block with the German block visible three lines below is far less likely to leave it behind,
and the sync reports any file missing a language, so a gap is loud rather than silent. A test asserts
all 17 files carry all three.

**2. How updating works — edit the markdown, then one admin request.**
`POST /api/admin/kb/sync`. An admin route rather than a CLI script because this server has no
ts-node/tsx and the embedding helpers are TypeScript under `src/lib`; running inside Next costs no
new dependency and turns re-indexing into one authenticated request instead of a deploy.
`GET` on the same path shows what is currently indexed, including how many chunks lack a vector.

**Incrementality is real, and measured.** Every language block and every chunk carries a SHA-256.
Editing one line of `accounting.md` produced: *48 documents unchanged, 3 updated, 3 chunks embedded.*

**3. No pgvector, no new database.** Vectors are JSON in SQLite TEXT columns — the convention
`BusinessMemory.embedding` already uses — scored in memory. 74 chunks per language is a
sub-millisecond scan. The threshold at which this needs revisiting (a few thousand chunks per
language) is written into `search.ts`.

## Measured, not assumed

**Multilingual embeddings genuinely share one vector space.** The same sentence, embedded in three
languages, against an unrelated sentence:

| Pair | Cosine |
|---|---|
| Persian ↔ English (same meaning) | **0.645** |
| German ↔ English (same meaning) | **0.803** |
| English ↔ unrelated topic | 0.271 |

**Retrieval answers real questions.** Ten questions a confused user would actually type, across
three languages, against the live index — **10/10 return the correct document as the top hit.**
Examples: `"چرا نمی‌تونم پست اینستاگرام رو خودکار منتشر کنم؟"` → `social/انتشار خودکار وجود ندارد`
(0.709); `"I am a team member and cannot see all deals"` → `crm/Why can't I see some deals?` (0.651);
`"Warum ist mein Konto plötzlich eingeschränkt?"` → the right troubleshooting section (0.551).

## Four bugs the measurements caught — all of which read as "working" from the source

**1. Embedding stopped at exactly 100 chunks and said nothing.** The first full sync reported
`embedded: 100` of 222. Cohere's free tier caps *requests* per minute, not texts, and `embedText`
sends one text per request. The remaining 122 chunks were stored with `embedding: null` — an index
that is 55% keyword-only, with a successful-looking report. Fixed by adding `embedTexts()` (batches
of 96) and restructuring the sync into decide → embed-once → write: **222 requests became 3, and
49s became 4.9s.**

**2. A Persian query retrieved the wrong document entirely.** `"فاکتور کجاست؟"` returned the
"where is it?" sections of Social, CRM and Industry packs, and missed Accounting. Cause: every
capability doc has a section with the identical Persian heading `کجاست؟`, and those short sections
embedded to near-identical vectors. Fixed by prefixing each chunk's embedded text with its document
title (the citation label stays the bare heading). English went from 0.501 → 0.639 on the same
question; Persian now ranks Accounting first.

**3. That fix silently did nothing.** Re-syncing after changing the chunker reported *"51 unchanged"* —
correctly, since block hashes come from the markdown source and not a byte of it had changed. The
index was entirely stale while the report looked perfect. Fixed with a `CHUNKER_VERSION` constant
mixed into the block hash: a chunking or embedding-strategy change now invalidates everything, which
is the correct blast radius for it. `?force=1` is the manual escape hatch.

**4. A real content error in the docs.** Chasing bug 2 surfaced that "invoices" was missing from the
Accounting document's list of sub-pages — in all three languages. The assistant would have told users
invoices weren't there. Fixed in the content, which is exactly the kind of fix this design makes
cheap.

Also fixed: `syncKnowledgeBase` would have **deleted the entire knowledge base** if run against an
empty or unreadable directory, because Prisma's `notIn: []` matches every row. Now guarded and
reported.

## Security notes

- **The KB is deliberately not tenant data.** No `userId` column, one shared doc-set, and **nothing
  user-submitted is ever ingested** — which is what stops retrieval from becoming a prompt-injection
  vector (§4). This is stated in the schema comment so it isn't "fixed" later by mistake.
- **The sync route is `requireAdmin`-gated**, both POST and GET.
- **German injection patterns added** to `promptSafety.ts`, closing the gap Phase 1 found:
  `"Ignoriere alle vorherigen Anweisungen"` now flags where its English twin already did.
  `wrapUntrustedContent` also takes an optional language so the delimiter instruction can be written
  in the prompt's own language; every existing call site keeps its exact current wording.
- **`.gitignore` needed care.** `/docs/` was ignored wholesale, which would have kept the doc-set out
  of version control. Changed to `/docs/*` plus `!/docs/knowledge-base/` — verified that
  `env.local.backup.txt`, `prod.db.backup` and the investor materials all **remain ignored**, and
  that exactly the 18 knowledge-base files become trackable.

## Verification

- `npx tsc --noEmit` — **0 errors** (the repo's baseline is also 0; the new files initially broke it
  on ES5 target and were rewritten to match the codebase's existing constraint rather than changing
  the shared tsconfig).
- `npx vitest run` — **21 files, 188 tests, all passing** (up from 170).
- `npx next lint` on every new and changed file — clean.
- Real sync against the real dev database with the real Cohere key, four times over: full index,
  no-op re-run, chunker-version rebuild, and one-line content edit. Dev database backed up before
  the migration and the backup removed after.

Not verified: the production index. Nothing has been deployed; the migration has been applied to the
**local dev database only**.

## Carried forward to Phase 3

1. **`FREELLMAPI_API_KEY` on production is still unconfirmed** (Phase 0/1 item — SSH was blocked).
   Phase 3's assistant must fail loudly if its configured free model is unavailable rather than
   silently falling through to paid Claude.
2. **No admin UI button for the sync yet** — it is an API route only. That is a UI change, so it
   belongs with Phase 3 where it can be checked in all three languages and at mobile width, per the
   standing rule.
3. **Deploy requirement:** `prisma/migrations/20260911_knowledge_base/migration.sql` must be applied
   and `npx prisma generate` run on the server, or every KB query throws at runtime while the rest of
   the site looks healthy (`PROJECT_CONTEXT.md`, deploy trap 2). Then one `POST /api/admin/kb/sync`.
4. **Honest note on sync cost:** the sync issues one query per language block (51) and one insert per
   chunk (222). That is fine for an admin-triggered operation and nowhere near a request path, but it
   is not batched and should not be wired to anything automatic without revisiting.
