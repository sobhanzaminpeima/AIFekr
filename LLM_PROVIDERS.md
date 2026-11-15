# Dynamic LLM providers (Coarena)

AIFekr has two kinds of chat providers:

- **Static providers** are fixed in code (`src/lib/ai/providers.ts`): Claude, GPT-5, DeepSeek, Groq and others. Admins can switch them on or off.
- **Dynamic providers** are stored in the database (`LlmProvider`). Their model list is synced from the provider's own API. The first one is **Coarena** (`https://coarena.ai/api/v1`, OpenAI-compatible).

Both kinds go through the same router (`src/lib/ai/router.ts`) and the same usage ledger. Code for dynamic providers is in `src/lib/ai/llmProviders/`:

| File | Role |
| --- | --- |
| `coarena.ts` | HTTP adapter: `listModels`, `testConnection`, `chatCompletion`, `streamChat`, `createResponse`, `fetchLimits`, `fetchUsage`, `fetchRequests`, `fetchRequest` |
| `normalize.ts` | Defensive parsers for models, usage, limits and request history. They keep only whitelisted fields. |
| `errors.ts` | Error categories, Persian user messages, `Retry-After` handling, backoff and redaction |
| `registry.ts` | Provider rows, keys, the cache of enabled models the router reads, model sync, health checks and usage snapshots |
| `run.ts` | One chat call to a dynamic model: re-checks the model, takes a limit slot, calls the adapter, records the result |
| `limits.ts` | Internal caps (per provider, model and user, plus concurrency) |
| `ledger.ts` | Unified usage ledger (`LlmUsageEvent`) for every provider |
| `admin.ts` | Admin role checks, audit log, masked views, settings validation and the usage dashboard |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `COARENA_API_KEY` | For chat, limits and usage | Coarena key. Server environment only. |
| `COARENA_BASE_URL` | No | Base URL used the first time the provider row is created. Default: `https://coarena.ai/api/v1`. After that, change it in the admin panel. |
| `CRON_SECRET` | Already in use | Authenticates `/api/cron/llm-providers` |
| `TOKEN_ENCRYPTION_KEY` (or `JWT_SECRET`) | Already in use | Encrypts a key an admin saves in the panel |

Never commit a real key. `.env.example` lists these variables with empty values.

## Migration

`prisma/migrations/20261114120000_llm_providers` only adds tables and indexes. It never drops or alters anything. It creates:

- `LlmProvider`
- `LlmProviderModel` (unique on `providerId` + `externalId`)
- `LlmUsageEvent`
- `LlmProviderSnapshot`
- `LlmUsageCounter`

Apply it with the normal additive release, or locally:

```bash
npx prisma migrate deploy
npx prisma generate
```

On first use the Coarena row is created **disabled**. The current Coarena catalogue is seeded as disabled models, so nothing is reachable until an admin turns it on.

## Setup and daily use (Admin → LLM Management)

1. Set `COARENA_API_KEY` on the server and restart. The provider card shows the key as `••••••••abcd` with the source "server environment".
2. Click **Test connection**. It calls `GET /limits`, which is free and calls no model. The result updates the health status: Healthy, Degraded, Offline or Unknown.
3. Click **Sync models**. It reads `GET /models`, which is public and free.
4. Enable the models users may pick. Optionally set a default model, credit cost, priority and caps.
5. Switch the provider on.

What users see:

- Enabled models appear in the chat model picker as "Model · Coarena", in both themes.
- Requests always go through the AIFekr backend. The browser never sees the key.
- A disabled, unavailable or made-up model id gets HTTP 400 `MODEL_UNAVAILABLE` before any credit check or upstream call.

### How model sync works

Sync is idempotent:

- New models are added **disabled**.
- Known models get the provider's latest name, limits and capabilities.
- Models the provider no longer lists are marked **unavailable**, never deleted. The admin's enabled flag, priority, credit cost and caps are kept.
- An empty or unreadable list changes nothing. The provider then shows `lastSyncError`.

### Changing or revoking the key

- **Environment key:** replace `COARENA_API_KEY` on the server and restart. Then run *Test connection*.
- **Key saved in the panel:** only a SUPER_ADMIN can save one. It is encrypted with the existing secretBox (`enc:v1:`) and takes priority over the environment key. The panel never shows it again, only its last four characters. *Use server key* removes it and switches back to `COARENA_API_KEY`.
- **Revoke:** revoke the key in Coarena's dashboard. Then switch the provider off here, or clear the saved key. The next health check shows Offline (AUTH).

Every change to settings, keys, models, defaults or limits is recorded in `AuditLog` as `llm.provider_settings`, `llm.models_updated`, `llm.models_synced` or `llm.provider_tested`. The key itself is never logged, only "replaced" or "cleared".

## Limits and fallback

All of these are set per provider in the panel and checked **before** any call to Coarena:

| Setting | Meaning |
| --- | --- |
| Daily request cap | Per provider, per UTC day |
| Model daily cap | Per model, per UTC day |
| Per-user daily cap | Per user per provider, per UTC day |
| Max output tokens | Upper bound for `max_tokens` |
| Max concurrency | Calls in flight at the same time (per server process) |
| Soft warning % | When a counter reaches this share of its cap, a warning goes to the admin error log, once per day |
| Hard stop % | Requests are refused at cap × % / 100. 100 means exactly the cap. |

How the caps are enforced:

- The day counters (`LlmUsageCounter`) are incremented inside one transaction. Parallel requests can never exceed a cap.
- A refused request gets a clear Persian message.
- A refused request is written to the ledger as `BLOCKED`. It costs nothing.
- Counters are removed after 3 days by the cron job.

Two fallback settings:

- **Fallback on error** (off by default): when a Coarena model the user picked fails, AIFekr's normal fallback chain answers instead. When off, the user gets a Persian message for that error (for example quota used up, rate limit or timeout).
- **Use in automatic routing** (off by default): the provider's default model is added as a last resort to the "auto" routing chain.

The chain is a finite list that never contains the provider that just failed, so it cannot loop.

Errors from Coarena are mapped to categories:

| HTTP status / Coarena code | Category |
| --- | --- |
| 401 | AUTH |
| 403 | FORBIDDEN |
| 404, `model_off` | NOT_FOUND |
| 408, 504 | TIMEOUT |
| 429 `rate_limit_exceeded` | RATE_LIMIT |
| 429 `insufficient_quota` | QUOTA |
| 5xx | UPSTREAM |

How retries work:

- TIMEOUT, RATE_LIMIT, UPSTREAM and network errors are retried up to 3 attempts in total. The wait uses exponential backoff with jitter, or `Retry-After` when it is 4 s or less.
- A stream is never retried once text has reached the user.
- Failed calls carry no tokens or cost in the ledger.
- Upstream bodies and headers are never shown or logged. Only the short Coarena error code and request id are kept.

Cancelling: when the user closes the chat, the upstream request is aborted and the fallback chain stops.

## Usage & Credits dashboard

The dashboard (`GET /api/admin/llm/usage`) covers every provider, static and dynamic. Filters: today, 7 days, 30 days or a custom range, plus provider, model, user and status.

Each figure is labelled with its source:

- **Locally tracked:** AIFekr's own ledger (`LlmUsageEvent`). Requests, success and error counts, tokens, users, average latency and success rate per provider and per model. Static providers are recorded from this release on.
- **Provider reported:** what Coarena's `/limits` and `/usage` said. This covers credit left today, used today, daily limit, requests today and reset time. Each figure shows when it was fetched and is marked stale after 15 minutes. Only dynamic providers have this.
- **Estimated:** cost computed from the admin's `AiModelPricing` rows. These use the key `coarena:<model>` or `coarena`. It is shown separately and never added to reported cost. Coarena's own exact cost per request (`usage.cost`, when sent) is stored as reported cost.

*Refresh* (`POST /api/admin/llm/usage`) re-reads the provider figures. Snapshots younger than 30 seconds are reused, and the panel reads cached snapshots, so opening the page never multiplies upstream calls.

Prompts and answers are never stored in the ledger.

## Scheduler

The app has no in-process scheduler. Like every other periodic job, it relies on the server's crontab calling a `/api/cron/*` route with `CRON_SECRET`. Add one line that runs every 10 minutes:

```bash
*/10 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://aifekr.com/api/cron/llm-providers >/dev/null
```

Each run does only what is due:

- model sync every 6 hours, for all providers (free)
- health check every 10 minutes, for enabled providers
- limits and usage refresh every 10 minutes, for enabled providers
- removal of old counters

A lease in `SiteSetting` (`llm_lease:*`) prevents overlapping runs. The response lists only statuses and safe error codes.

## Privacy

Data sent to Coarena (messages and the system prompt) is processed under Coarena's own terms and privacy policy. The admin panel says so next to the provider. AIFekr stores no prompt or answer for these calls beyond what the chat feature already saves in the user's own conversation.

## Tests

Run:

```bash
npx vitest run src/lib/ai/llmProviders src/lib/ai/router.test.ts
```

What they cover:

- **Adapter, against a local mock server:** models, connection test, chat, streaming, `/responses`, limits, usage, request history, every error class, `Retry-After`, backoff, timeout, cancellation and broken or changed schemas.
- **Integration, on the isolated test database:**
  - sync idempotency and unavailable models, key masking and encryption
  - routing and picker visibility, refusal of disabled models
  - exactly one ledger row per call, all caps including a parallel race
  - health status and snapshot caching, admin authorization, validation, audit and dashboard aggregation

No test touches the real Coarena service.

## Known limits

- Concurrency limits are counted per server process. AIFekr runs as one process.
- Only chat (streaming) goes through Coarena for users. `createResponse` and request lookups exist in the adapter for future features and admin use.
- Coarena's per-model price list is currently `0`/`0` (free tier with a daily dollar allowance). Estimated cost therefore stays empty until an admin enters a price in `AiModelPricing`.
- Model credit cost defaults to the provider's default (3, the same as custom providers). Admins set real prices per model; AIFekr never changes them automatically.
