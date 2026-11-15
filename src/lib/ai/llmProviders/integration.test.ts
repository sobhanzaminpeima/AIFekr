/**
 * End-to-end checks against the isolated test database (prisma/vitest.db) and
 * a local mock of the Coarena API. No real Coarena call is ever made.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));
vi.mock("@/lib/auth/middleware", async () => {
  const { NextResponse: R } = await import("next/server");
  return { requireAuth: async () => auth.user, unauthorizedResponse: () => R.json({ error: "Unauthorized" }, { status: 401 }) };
});
vi.mock("@/lib/growth/generation", () => ({ recordGenerationStarted: async () => {}, recordGenerationFailed: async () => {}, recordGenerationSucceeded: async () => {} }));

import { prisma } from "@/lib/db/prisma";
import { MODELS_FIXTURE, LIMITS_FIXTURE, USAGE_FIXTURE, delta, sse, startMockCoarena } from "./__fixtures__/mockCoarena";
import { COARENA_BOOTSTRAP_MODELS, COARENA_ID, checkHealth, dynamicEntry, ensureProviders, getDynamicProviders, invalidateDynamicProviders, maskKey, refreshSnapshot, syncModels } from "./registry";
import { acquireLimits, resetLimitState } from "./limits";
import { runWithLlmContext } from "./context";
import { LlmProviderError } from "./errors";
import { findChatProvider, routedStreamChat } from "../router";
import { streamProvider, type Provider } from "../providers";
import { GET as listProviders } from "@/app/api/admin/llm/providers/route";
import { PATCH as patchProvider } from "@/app/api/admin/llm/providers/[id]/route";
import { PATCH as patchModels } from "@/app/api/admin/llm/providers/[id]/models/route";
import { POST as syncRoute } from "@/app/api/admin/llm/providers/[id]/sync/route";
import { POST as testRoute } from "@/app/api/admin/llm/providers/[id]/test/route";
import { GET as usageRoute } from "@/app/api/admin/llm/usage/route";
import { POST as chatRoute } from "@/app/api/chat/route";
import { GET as pickerRoute } from "@/app/api/ai/chat-providers/route";

// The shared SQLite test database is slow when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const KEY = "coa_test_secret_key_ABCDEFGH1234";
let mock: Awaited<ReturnType<typeof startMockCoarena>>;
const params = { params: Promise.resolve({ id: COARENA_ID }) };
const req = (url: string, body?: unknown, method = body === undefined ? "GET" : "PATCH") => new NextRequest("http://localhost" + url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const msgs = [{ role: "user" as const, content: "سلام" }];

async function resetDb() {
  await prisma.llmUsageEvent.deleteMany();
  await prisma.llmUsageCounter.deleteMany();
  await prisma.llmProviderSnapshot.deleteMany();
  await prisma.llmProvider.deleteMany();
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: "llm_lease:" } } });
  await ensureProviders();
  await prisma.llmProvider.update({ where: { id: COARENA_ID }, data: { baseUrl: mock.baseUrl, enabled: true, timeoutMs: 5000 } });
}
async function syncFixture() {
  mock.script("GET /models", { status: 200, json: MODELS_FIXTURE });
  return syncModels(COARENA_ID);
}
async function enable(ids: string[], data: Record<string, unknown> = {}) {
  await prisma.llmProviderModel.updateMany({ where: { providerId: COARENA_ID, externalId: { in: ids } }, data: { enabled: true, ...data } });
  await invalidateDynamicProviders();
}

beforeAll(async () => {
  mock = await startMockCoarena();
  process.env.COARENA_API_KEY = KEY;
});
afterAll(async () => { await mock.close(); delete process.env.COARENA_API_KEY; });
beforeEach(async () => { mock.reset(); resetLimitState(); auth.user = null; await resetDb(); });

describe("model sync", () => {
  it("seeds the bootstrap catalogue once, disabled", async () => {
    const rows = await prisma.llmProviderModel.findMany({ where: { providerId: COARENA_ID } });
    expect(rows.map((r) => r.externalId).sort()).toEqual([...COARENA_BOOTSTRAP_MODELS].sort());
    expect(rows.every((r) => !r.enabled)).toBe(true);
    await ensureProviders();
    expect(await prisma.llmProviderModel.count({ where: { providerId: COARENA_ID } })).toBe(COARENA_BOOTSTRAP_MODELS.length);
  });

  it("adds, updates and marks missing models unavailable without touching admin choices", async () => {
    await enable(["claude-opus-5-5"], { priority: 5, creditCost: 7 });
    const first = await syncFixture();
    expect(first).toMatchObject({ ok: true, added: 0, updated: 3, unavailable: COARENA_BOOTSTRAP_MODELS.length - 3 });
    const opus = await prisma.llmProviderModel.findUniqueOrThrow({ where: { providerId_externalId: { providerId: COARENA_ID, externalId: "claude-opus-5-5" } } });
    expect(opus).toMatchObject({ enabled: true, priority: 5, creditCost: 7, displayName: "Claude Opus 5.5", contextWindow: 200000, available: true });
    expect(await prisma.llmProviderModel.count({ where: { providerId: COARENA_ID } })).toBe(COARENA_BOOTSTRAP_MODELS.length); // nothing deleted

    mock.script("GET /models", { status: 200, json: { data: [...MODELS_FIXTURE.data.slice(0, 2), { id: "brand-new-1", display_name: "Brand New" }] } });
    const second = await syncModels(COARENA_ID);
    expect(second).toMatchObject({ ok: true, added: 1, unavailable: 1 });
    const hy4 = await prisma.llmProviderModel.findUniqueOrThrow({ where: { providerId_externalId: { providerId: COARENA_ID, externalId: "hy4" } } });
    expect(hy4.available).toBe(false);
    const fresh = await prisma.llmProviderModel.findUniqueOrThrow({ where: { providerId_externalId: { providerId: COARENA_ID, externalId: "brand-new-1" } } });
    expect(fresh.enabled).toBe(false);
    const provider = await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } });
    expect(provider.lastSyncAt).not.toBeNull();
    expect(provider.lastSyncError).toBeNull();
  });

  it("changes nothing when the list comes back empty or broken, and records a safe error", async () => {
    await syncFixture();
    mock.script("GET /models", { status: 200, json: { data: [] } });
    expect(await syncModels(COARENA_ID)).toMatchObject({ ok: false, error: "BAD_RESPONSE" });
    expect(await prisma.llmProviderModel.count({ where: { providerId: COARENA_ID, available: true } })).toBe(3);
    expect((await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } })).lastSyncError).toBe("BAD_RESPONSE");
  });
});

describe("keys", () => {
  it("reads the key from the environment and only ever shows it masked", async () => {
    const row = await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } });
    expect(row.credentialRef).toBe("env:COARENA_API_KEY");
    const m = maskKey(row);
    expect(m).toEqual({ source: "env", envName: "COARENA_API_KEY", masked: "••••••••1234" });
  });

  it("builds router models that never carry the key, and none without a key", async () => {
    await syncFixture();
    await enable(["claude-opus-5-5"]);
    const list = getDynamicProviders();
    expect(list.map((p) => p.model)).toEqual(["coarena:claude-opus-5-5"]);
    expect(list[0].apiKey).toBe("");
    expect(JSON.stringify(list)).not.toContain(KEY);
    delete process.env.COARENA_API_KEY;
    await invalidateDynamicProviders();
    expect(getDynamicProviders()).toEqual([]);
    process.env.COARENA_API_KEY = KEY;
  });
});

describe("routing and the user's model choice", () => {
  beforeEach(async () => { await syncFixture(); await enable(["claude-opus-5-5"]); mock.reset(); });

  it("finds only enabled, available models of an enabled provider", async () => {
    expect(findChatProvider("coarena:claude-opus-5-5")?.name).toBe("Claude Opus 5.5 · Coarena");
    expect(findChatProvider("coarena:gpt-6-luna")).toBeUndefined(); // not enabled
    expect(findChatProvider("coarena:kimi-k3")).toBeUndefined(); // no longer listed upstream
    await prisma.llmProvider.update({ where: { id: COARENA_ID }, data: { enabled: false } });
    await invalidateDynamicProviders();
    expect(findChatProvider("coarena:claude-opus-5-5")).toBeUndefined();
  });

  it("streams a picked model and records exactly one ledger row with the user and upstream id", async () => {
    mock.script("POST /chat/completions", { status: 200, headers: { "x-request-id": "req_ok_1" }, sse: [delta("سلام "), delta("دنیا"), sse({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } }), "data: [DONE]\n\n"] });
    let text = "";
    const used = await runWithLlmContext({ userId: "llm-u1", feature: "chat" }, () => routedStreamChat(msgs, "sys", (t) => { text += t; }, () => {}, "coarena:claude-opus-5-5"));
    expect(used.id).toBe("coarena:claude-opus-5-5");
    expect(text).toBe("سلام دنیا");
    expect((mock.seen[0].body as { model: string }).model).toBe("claude-opus-5-5");
    const events = await prisma.llmUsageEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ providerId: "coarena", modelId: "coarena:claude-opus-5-5", userId: "llm-u1", status: "SUCCESS", upstreamRequestId: "req_ok_1", inputTokens: 12, outputTokens: 4, totalTokens: 16, errorCategory: null });
    expect(events[0].metadata).not.toContain("سلام");
  });

  it("does not fall back by default: the typed error reaches the caller and nothing is billed", async () => {
    mock.script("POST /chat/completions", { status: 401, json: { error: { code: "invalid_api_key", message: KEY } } });
    const fallbacks: string[] = [];
    const err = await routedStreamChat(msgs, "sys", () => {}, () => {}, "coarena:claude-opus-5-5", (f) => fallbacks.push(f.from.id)).catch((e) => e);
    expect(err).toBeInstanceOf(LlmProviderError);
    expect((err as LlmProviderError).category).toBe("AUTH");
    expect(fallbacks).toEqual([]);
    const [event] = await prisma.llmUsageEvent.findMany();
    expect(event).toMatchObject({ status: "ERROR", errorCategory: "AUTH", inputTokens: null, reportedCostUsd: null });
  });

  it("refuses a model disabled after the router picked it", async () => {
    const p = findChatProvider("coarena:claude-opus-5-5")!;
    await prisma.llmProviderModel.updateMany({ where: { externalId: "claude-opus-5-5" }, data: { enabled: false } });
    await invalidateDynamicProviders();
    expect(dynamicEntry(p.id)).toBeUndefined();
    await expect(streamProvider(p, msgs, "sys", () => {})).rejects.toMatchObject({ category: "NOT_FOUND" });
    expect(mock.seen).toHaveLength(0);
  });
});

describe("the user-facing chat API", () => {
  beforeEach(async () => { await syncFixture(); await enable(["claude-opus-5-5"]); mock.reset(); auth.user = { id: "llm-u1", role: "USER" }; });
  const post = (model: string) => chatRoute(new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ message: "سلام", model }) }));

  it("offers enabled Coarena models in the picker with the provider in the name", async () => {
    const body = await (await pickerRoute(new NextRequest("http://localhost/api/ai/chat-providers"))).json();
    const coarena = body.providers.filter((p: { model: string }) => p.model.startsWith("coarena:"));
    expect(coarena).toEqual([{ id: "coarena:claude-opus-5-5", name: "Claude Opus 5.5 · Coarena", model: "coarena:claude-opus-5-5", creditCost: 3, providerName: "coarena" }]);
  });

  it("refuses a disabled, unlisted or made-up model id before charging or calling anything", async () => {
    for (const model of ["coarena:gpt-6-luna", "coarena:kimi-k3", "coarena:does-not-exist"]) {
      const res = await post(model);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "MODEL_UNAVAILABLE" });
    }
    expect(mock.seen).toHaveLength(0);
    expect(await prisma.llmUsageEvent.count()).toBe(0);
  });
});

describe("internal limits", () => {
  beforeEach(async () => { await syncFixture(); await enable(["claude-opus-5-5"]); mock.reset(); });
  const okStream = () => ({ status: 200 as const, sse: [delta("ok"), "data: [DONE]\n\n"] });

  it("blocks the request over the provider's daily cap before calling Coarena", async () => {
    await prisma.llmProvider.update({ where: { id: COARENA_ID }, data: { dailyRequestCap: 2 } });
    await invalidateDynamicProviders();
    const p = findChatProvider("coarena:claude-opus-5-5")!;
    mock.script("POST /chat/completions", okStream(), okStream());
    await streamProvider(p, msgs, "s", () => {});
    await streamProvider(p, msgs, "s", () => {});
    const err = await streamProvider(p, msgs, "s", () => {}).catch((e) => e);
    expect(err).toMatchObject({ category: "LIMIT", scope: "provider" });
    expect(mock.seen).toHaveLength(2);
    expect(await prisma.llmUsageEvent.count({ where: { status: "BLOCKED", errorCategory: "LIMIT" } })).toBe(1);
  });

  it("applies the per-user cap and the hard-stop percentage", async () => {
    await prisma.llmProvider.update({ where: { id: COARENA_ID }, data: { perUserDailyCap: 4, hardStopPercent: 50 } });
    await invalidateDynamicProviders();
    const p = findChatProvider("coarena:claude-opus-5-5")!;
    mock.script("POST /chat/completions", okStream(), okStream(), okStream());
    const call = (userId: string) => runWithLlmContext({ userId }, () => streamProvider(p, msgs, "s", () => {}));
    await call("llm-u1");
    await call("llm-u1");
    await expect(call("llm-u1")).rejects.toMatchObject({ scope: "user" }); // 50% of 4 = 2
    await call("someone-else");
  });

  it("never lets parallel requests exceed a cap", async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => acquireLimits({ providerId: "race", modelKey: "race:m", dailyRequestCap: 3 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await prisma.llmUsageCounter.findFirstOrThrow({ where: { key: { startsWith: "provider:race:" } } })).count).toBe(3);
  });

  it("limits concurrency per provider and frees the slot afterwards", async () => {
    const release = await acquireLimits({ providerId: "conc", modelKey: "conc:m", maxConcurrency: 1 });
    await expect(acquireLimits({ providerId: "conc", modelKey: "conc:m", maxConcurrency: 1 })).rejects.toMatchObject({ scope: "concurrency" });
    release();
    (await acquireLimits({ providerId: "conc", modelKey: "conc:m", maxConcurrency: 1 }))();
  });

  it("caps output tokens at the admin's maximum", async () => {
    await prisma.llmProvider.update({ where: { id: COARENA_ID }, data: { maxOutputTokens: 300 } });
    await invalidateDynamicProviders();
    mock.script("POST /chat/completions", okStream());
    await streamProvider(findChatProvider("coarena:claude-opus-5-5")!, msgs, "s", () => {}, 50_000);
    expect((mock.seen[0].body as { max_tokens: number }).max_tokens).toBe(300);
  });
});

describe("health and provider-reported usage", () => {
  it("records HEALTHY, DEGRADED and OFFLINE with a safe error code", async () => {
    mock.script("GET /limits", { status: 200, json: LIMITS_FIXTURE });
    expect((await checkHealth(COARENA_ID)).status).toBe("HEALTHY");
    mock.script("GET /limits", { status: 429, json: { error: { code: "insufficient_quota" } } });
    expect((await checkHealth(COARENA_ID)).status).toBe("DEGRADED");
    mock.script("GET /limits", { status: 401, json: { error: { code: "invalid_api_key", message: KEY } } });
    const off = await checkHealth(COARENA_ID);
    expect(off).toMatchObject({ status: "OFFLINE", error: "AUTH" });
    const row = await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } });
    expect(row).toMatchObject({ healthStatus: "OFFLINE", lastError: "AUTH" });
  });

  it("stores normalized limits/usage and serves them from cache", async () => {
    mock.script("GET /limits", { status: 200, json: LIMITS_FIXTURE });
    mock.script("GET /usage", { status: 200, json: USAGE_FIXTURE });
    const snap = await refreshSnapshot(COARENA_ID);
    expect(snap).toMatchObject({ status: "OK", creditRemainingUsd: 3.7, usedTodayUsd: 1.25, dailyLimitUsd: 5, requestsToday: 42 });
    expect(snap?.data).not.toContain("coa_live_abc");
    const calls = mock.seen.length;
    await refreshSnapshot(COARENA_ID);
    expect(mock.seen.length).toBe(calls);
  });
});

describe("static providers share the ledger", () => {
  it("records a static provider's call with its tokens", async () => {
    const p: Provider = { id: "test-static", name: "Static", provider: "custom", model: "static-m", baseURL: mock.baseUrl, apiKey: KEY, strengths: [], maxTokens: 50, creditCost: 1 };
    mock.script("POST /chat/completions", { status: 200, sse: [delta("x"), sse({ choices: [], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }), "data: [DONE]\n\n"] });
    await runWithLlmContext({ userId: "llm-u1" }, () => streamProvider(p, msgs, "s", () => {}));
    await vi.waitFor(async () => expect(await prisma.llmUsageEvent.count({ where: { providerId: "test-static" } })).toBe(1), { timeout: 15_000, interval: 100 });
    expect(await prisma.llmUsageEvent.findFirst({ where: { providerId: "test-static" } })).toMatchObject({ modelId: "static-m", status: "SUCCESS", totalTokens: 3, userId: "llm-u1" });
  });
});

describe("admin API", () => {
  it("is closed to non-admins", async () => {
    auth.user = { id: "u", role: "USER" };
    expect((await listProviders(req("/api/admin/llm/providers"))).status).toBe(401);
    expect((await patchProvider(req("/api/admin/llm/providers/coarena", { enabled: false }), params)).status).toBe(401);
  });

  it("lists the provider with a masked key and today's per-model figures", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    const res = await listProviders(req("/api/admin/llm/providers"));
    const text = await res.text();
    expect(text).not.toContain(KEY);
    const body = JSON.parse(text);
    expect(body.providers[0]).toMatchObject({ id: "coarena", key: { configured: true, source: "env", masked: "••••••••1234" }, enabled: true });
    expect(body.providers[0].models[0].today).toEqual({ requests: 0, errors: 0, tokens: 0, users: 0 });
  });

  it("lets only a super admin set a key, stores it encrypted and audits without it", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    const denied = await patchProvider(req("/api/admin/llm/providers/coarena", { apiKey: "coa_new_vault_key_XYZ98765" }), params);
    expect(denied.status).toBe(403);
    auth.user = { id: "super-1", role: "SUPER_ADMIN" };
    const ok = await patchProvider(req("/api/admin/llm/providers/coarena", { apiKey: "coa_new_vault_key_XYZ98765" }), params);
    const text = await ok.text();
    expect(ok.status).toBe(200);
    expect(text).not.toContain("coa_new_vault_key_XYZ98765");
    expect(JSON.parse(text).provider.key).toMatchObject({ source: "vault", masked: "••••••••8765" });
    const row = await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } });
    expect(row.credentialRef.startsWith("enc:v1:")).toBe(true);
    expect(row.credentialRef).not.toContain("XYZ98765");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "llm.provider_settings", actorId: "super-1" }, orderBy: { createdAt: "desc" } });
    expect(log.metadata).toContain("apiKey:replaced");
    expect(log.metadata).not.toContain("XYZ98765");
    const cleared = await patchProvider(req("/api/admin/llm/providers/coarena", { clearKey: true }), params);
    expect(cleared.status).toBe(200);
    expect((await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } })).credentialRef).toBe("env:COARENA_API_KEY");
  });

  it("validates settings: https only, no private hosts, soft below hard", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    expect(await (await patchProvider(req("/api/admin/llm/providers/coarena", { baseUrl: "http://example.com/v1" }), params)).json()).toEqual({ error: "INVALID_BASE_URL" });
    expect(await (await patchProvider(req("/api/admin/llm/providers/coarena", { baseUrl: "https://10.0.0.5/v1" }), params)).json()).toEqual({ error: "UNSAFE_BASE_URL" });
    expect((await patchProvider(req("/api/admin/llm/providers/coarena", { softWarnPercent: 90, hardStopPercent: 80 }), params)).status).toBe(400);
    expect((await patchProvider(req("/api/admin/llm/providers/coarena", { surprise: 1 }), params)).status).toBe(400);
    const ok = await patchProvider(req("/api/admin/llm/providers/coarena", { dailyRequestCap: 500, perUserDailyCap: 20, maxConcurrency: 4, fallbackEnabled: true, timeoutMs: 30000 }), params);
    expect((await ok.json()).changed).toEqual(expect.arrayContaining(["dailyRequestCap", "perUserDailyCap", "maxConcurrency", "fallbackEnabled", "timeoutMs"]));
  });

  it("bulk-enables models, refuses unavailable ones and sets the default", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    await syncFixture();
    const bulk = await patchModels(req("/api/admin/llm/providers/coarena/models", { ids: ["claude-opus-5-5", "gpt-6-luna"], enabled: true }), params);
    expect(bulk.status).toBe(200);
    expect(await prisma.llmProviderModel.count({ where: { providerId: COARENA_ID, enabled: true } })).toBe(2);
    const gone = await patchModels(req("/api/admin/llm/providers/coarena/models", { ids: ["kimi-k3"], enabled: true }), params);
    expect(await gone.json()).toEqual({ error: "MODEL_UNAVAILABLE" });
    await patchModels(req("/api/admin/llm/providers/coarena/models", { ids: ["gpt-6-luna"], makeDefault: true }), params);
    expect((await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } })).defaultModelId).toBe("gpt-6-luna");
    await patchModels(req("/api/admin/llm/providers/coarena/models", { ids: ["gpt-6-luna"], enabled: false }), params);
    expect((await prisma.llmProvider.findUniqueOrThrow({ where: { id: COARENA_ID } })).defaultModelId).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "llm.models_updated" } })).toBeGreaterThanOrEqual(3);
  });

  it("syncs and tests through the admin routes", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    mock.script("GET /models", { status: 200, json: MODELS_FIXTURE });
    expect(await (await syncRoute(req("/x", undefined, "POST"), params)).json()).toMatchObject({ ok: true, updated: 3 });
    mock.script("GET /limits", { status: 200, json: LIMITS_FIXTURE });
    expect(await (await testRoute(req("/x", undefined, "POST"), params)).json()).toMatchObject({ ok: true, status: "HEALTHY", error: null });
  });

  it("aggregates usage per provider and model, labelled by source, with filters", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    const now = new Date();
    const base = { providerId: "coarena", modelId: "coarena:claude-opus-5-5", endpoint: "chat.completions", startedAt: now, finishedAt: now };
    await prisma.llmUsageEvent.createMany({ data: [
      { ...base, requestId: "e1", userId: "llm-u1", status: "SUCCESS", inputTokens: 10, outputTokens: 5, totalTokens: 15, reportedCostUsd: 0.01, latencyMs: 1000 },
      { ...base, requestId: "e2", userId: "llm-u2", status: "SUCCESS", inputTokens: 20, outputTokens: 5, totalTokens: 25, estimatedCostUsd: 0.02, latencyMs: 3000 },
      { ...base, requestId: "e3", userId: "llm-u1", status: "ERROR", errorCategory: "RATE_LIMIT", latencyMs: 200 },
      { ...base, requestId: "e4", providerId: "claude", modelId: "claude-haiku", status: "SUCCESS", totalTokens: 9, latencyMs: 500 },
    ] });
    const body = await (await usageRoute(req("/api/admin/llm/usage?range=today"))).json();
    const coarena = body.providers.find((p: { providerId: string }) => p.providerId === "coarena");
    expect(coarena.dynamic).toBe(true);
    expect(coarena.local).toMatchObject({ requests: 3, success: 2, errors: 1, totalTokens: 40, reportedCostUsd: 0.01, estimatedCostUsd: 0.02, avgLatencyMs: 1400 });
    expect(body.providers.find((p: { providerId: string }) => p.providerId === "claude").local.requests).toBe(1);
    expect(body.models.find((m: { modelId: string }) => m.modelId === "coarena:claude-opus-5-5")).toMatchObject({ requests: 3, users: 2, successRate: 66.7 });
    const onlyErrors = await (await usageRoute(req("/api/admin/llm/usage?range=7d&status=ERROR&providerId=coarena"))).json();
    expect(onlyErrors.providers).toHaveLength(1);
    expect(onlyErrors.providers[0].local).toMatchObject({ requests: 1, errors: 1 });
    expect((await usageRoute(req("/api/admin/llm/usage?range=custom"))).status).toBe(400);
    expect((await usageRoute(req("/api/admin/llm/usage?range=year"))).status).toBe(400);
  });
});
