import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chatCompletion, createResponse, fetchLimits, fetchRequests, fetchUsage, listModels, streamChat, testConnection, type AdapterConfig } from "./coarena";
import { LlmProviderError } from "./errors";
import { LIMITS_FIXTURE, MODELS_FIXTURE, USAGE_FIXTURE, delta, sse, startMockCoarena } from "./__fixtures__/mockCoarena";

const KEY = "coa_test_key_0123456789abcdef";
let mock: Awaited<ReturnType<typeof startMockCoarena>>;
const waits: number[] = [];
const cfg = (over: Partial<AdapterConfig> = {}): AdapterConfig => ({ baseUrl: mock.baseUrl, apiKey: KEY, timeoutMs: 5_000, sleep: async (ms) => { waits.push(ms); }, ...over });
const chat = { model: "claude-opus-5-5", messages: [{ role: "user" as const, content: "hi" }] };
async function caught(p: Promise<unknown>): Promise<LlmProviderError> {
  try { await p; } catch (e) { return e as LlmProviderError; }
  throw new Error("expected a rejection");
}

beforeAll(async () => { mock = await startMockCoarena(); });
afterAll(async () => { await mock.close(); });
beforeEach(() => { mock.reset(); waits.length = 0; });

describe("Coarena adapter: catalogue, limits and usage", () => {
  it("lists models from /models with capabilities and limits", async () => {
    mock.script("GET /models", { status: 200, json: MODELS_FIXTURE });
    const models = await listModels(cfg());
    expect(models.map((m) => m.externalId)).toEqual(["claude-opus-5-5", "gpt-6-luna", "hy4"]);
    expect(models[0]).toMatchObject({ displayName: "Claude Opus 5.5", vision: true, tools: true, contextWindow: 200000, maxOutputTokens: 32000, lifecycle: "active" });
    expect(models[2]).toMatchObject({ displayName: "HY4", contextWindow: null, maxOutputTokens: null, lifecycle: "deprecated" });
    expect(mock.seen[0].auth).toBe(`Bearer ${KEY}`);
  });

  it("syncs the public catalogue even before a key is set", async () => {
    mock.script("GET /models", { status: 200, json: MODELS_FIXTURE });
    await listModels(cfg({ apiKey: "" }));
    expect(mock.seen[0].auth).toBeNull();
    await expect(fetchLimits(cfg({ apiKey: "" }))).rejects.toMatchObject({ category: "NOT_CONFIGURED" });
  });

  it("refuses a changed /models schema instead of guessing", async () => {
    mock.script("GET /models", { status: 200, json: { models: ["x"] } });
    expect((await caught(listModels(cfg()))).category).toBe("BAD_RESPONSE");
  });

  it("tests the connection through the free /limits endpoint", async () => {
    mock.script("GET /limits", { status: 200, json: LIMITS_FIXTURE, headers: { "x-request-id": "req_lim_1" } });
    const r = await testConnection(cfg());
    expect(r.limits).toMatchObject({ usdPerDay: 5, usedTodayUsd: 1.25, leftTodayUsd: 3.7, requestsToday: 42, concurrency: 4 });
    expect(r.upstreamRequestId).toBe("req_lim_1");
    expect(mock.seen.map((s) => s.path)).toEqual(["/limits"]);
  });

  it("reads usage and request history without previews of prompts or answers", async () => {
    mock.script("GET /usage", { status: 200, json: USAGE_FIXTURE });
    const usage = await fetchUsage(cfg(), "7d");
    expect(mock.seen[0].path).toBe("/usage?range=7d");
    expect(usage.today).toMatchObject({ requests: 42, spentUsd: 1.25, inFlight: 1 });
    expect(usage.models[0]).toMatchObject({ id: "claude-opus-5-5", requests: 200 });
    expect(usage.modelsOff).toEqual(["grok-4-7"]);
    expect(JSON.stringify(usage)).not.toContain("coa_live_abc");

    mock.script("GET /requests", { status: 200, json: { object: "list", data: [{ id: "r1", model: "gpt-6-luna", status: "finished", input_tokens: 5, output_tokens: 7, cost_usd: 0.001, latency_ms: 900, preview: "secret prompt", output_preview: "secret answer" }], has_more: false } });
    const reqs = await fetchRequests(cfg(), { limit: 5, model: "gpt-6-luna" });
    expect(reqs.data[0]).toMatchObject({ id: "r1", inputTokens: 5, outputTokens: 7, costUsd: 0.001 });
    expect(JSON.stringify(reqs)).not.toContain("secret");
  });
});

describe("Coarena adapter: chat", () => {
  it("returns text, usage and the request id for a non-streaming completion", async () => {
    mock.script("POST /chat/completions", { status: 200, json: { id: "chatcmpl-9", choices: [{ message: { content: "سلام" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }, headers: { "x-request-id": "req_123" } });
    const r = await chatCompletion(cfg(), { ...chat, maxTokens: 50 });
    expect(r).toMatchObject({ text: "سلام", upstreamRequestId: "req_123", usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 } });
    expect(mock.seen[0].body).toMatchObject({ model: "claude-opus-5-5", stream: false, max_tokens: 50 });
  });

  it("tolerates the newline padding Coarena sends before slow replies", async () => {
    mock.script("POST /chat/completions", { status: 200, json: "\n\n\n" + JSON.stringify({ choices: [{ message: { content: "ok" } }] }) });
    expect((await chatCompletion(cfg(), chat)).text).toBe("ok");
  });

  it("streams deltas, the final usage chunk and the request id", async () => {
    mock.script("POST /chat/completions", { status: 200, headers: { "x-request-id": "req_stream" }, sse: [delta("Hel"), "\n\n", delta("lo"), sse({ choices: [], usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6, cost: 0.0004 } }), "data: [DONE]\n\n"] });
    let text = "";
    const r = await streamChat(cfg(), chat, (t) => { text += t; });
    expect(text).toBe("Hello");
    expect(r).toMatchObject({ upstreamRequestId: "req_stream", usage: { totalTokens: 6, costUsd: 0.0004 } });
    expect(mock.seen[0].body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it("raises an error event inside a stream as UPSTREAM after the text already sent", async () => {
    mock.script("POST /chat/completions", { status: 200, sse: [delta("part"), sse({ error: { code: "upstream_error", message: "Bearer leaked-token-123456789" } })] });
    let text = "";
    const e = await caught(streamChat(cfg(), chat, (t) => { text += t; }));
    expect(text).toBe("part");
    expect(e.category).toBe("UPSTREAM");
    expect(e.message).not.toContain("leaked");
  });

  it("calls /responses and joins output_text parts", async () => {
    mock.script("POST /responses", { status: 200, json: { id: "resp_1", status: "completed", output: [{ content: [{ type: "output_text", text: "A" }, { type: "output_text", text: "B" }] }], usage: { input_tokens: 3, output_tokens: 2 } } });
    const r = await createResponse(cfg(), { model: "gpt-6-luna", input: "hi", maxOutputTokens: 20 });
    expect(r).toMatchObject({ text: "AB", upstreamRequestId: "resp_1", usage: { promptTokens: 3, completionTokens: 2 } });
    expect(mock.seen[0].body).toMatchObject({ max_output_tokens: 20, stream: false });
  });
});

describe("Coarena adapter: failures", () => {
  it("maps 401 to AUTH without retrying and never echoes the body or key", async () => {
    mock.script("POST /chat/completions", { status: 401, json: { error: { code: "invalid_api_key", message: `bad key ${KEY}`, type: "auth", param: null } }, headers: { "x-request-id": "req_401" } });
    const e = await caught(chatCompletion(cfg(), chat));
    expect(e).toBeInstanceOf(LlmProviderError);
    expect(e).toMatchObject({ category: "AUTH", status: 401, upstreamCode: "invalid_api_key", upstreamRequestId: "req_401" });
    expect(e.message).toBe("Coarena error 401: authentication failed");
    expect(e.message).not.toContain(KEY);
    expect(mock.seen).toHaveLength(1);
  });

  it("waits for Retry-After on a per-minute 429, then succeeds", async () => {
    mock.script("POST /chat/completions",
      { status: 429, json: { error: { code: "rate_limit_exceeded" } }, headers: { "retry-after": "2" } },
      { status: 200, json: { choices: [{ message: { content: "ok" } }] } });
    const r = await chatCompletion(cfg(), chat);
    expect(r).toMatchObject({ text: "ok", attempts: 2 });
    expect(waits).toEqual([2000]);
  });

  it("does not retry a 429 Retry-After longer than this request can wait", async () => {
    mock.script("POST /chat/completions", { status: 429, json: { error: { code: "rate_limit_exceeded" } }, headers: { "retry-after": "60" } });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("RATE_LIMIT");
    expect(mock.seen).toHaveLength(1);
  });

  it("treats exhausted daily credit as QUOTA (permanent today, not retried)", async () => {
    mock.script("POST /chat/completions", { status: 429, json: { error: { code: "insufficient_quota" } } });
    const e = await caught(chatCompletion(cfg(), chat));
    expect(e.category).toBe("QUOTA");
    expect(e.message).toContain("insufficient quota"); // the router's cooldown recognises this text
    expect(mock.seen).toHaveLength(1);
  });

  it("retries 5xx with backoff, then gives up after three attempts", async () => {
    mock.script("POST /chat/completions", { status: 503, json: { error: { code: "server_busy" } } }, { status: 502, json: {} }, { status: 503, json: {} });
    const e = await caught(chatCompletion(cfg(), chat));
    expect(e.category).toBe("UPSTREAM");
    expect(mock.seen).toHaveLength(3);
    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeGreaterThanOrEqual(200);
    expect(waits[0]).toBeLessThanOrEqual(400);
    expect(waits[1]).toBeGreaterThanOrEqual(400);
    expect(waits[1]).toBeLessThanOrEqual(800);
  });

  it("maps 403, 404 and 408 to their categories", async () => {
    mock.script("POST /chat/completions", { status: 403, json: { error: { code: "account_blocked" } } });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("FORBIDDEN");
    mock.script("POST /chat/completions", { status: 404, json: { error: { code: "model_not_found" } } });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("NOT_FOUND");
    mock.script("POST /chat/completions", { status: 408, json: {} }, { status: 408, json: {} }, { status: 408, json: {} });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("TIMEOUT");
  });

  it("times out a hung request", async () => {
    mock.script("POST /chat/completions", { hang: true }, { hang: true }, { hang: true });
    const e = await caught(chatCompletion(cfg({ timeoutMs: 1000, retry: { attempts: 1, baseMs: 1, maxDelayMs: 1 } }), chat));
    expect(e.category).toBe("TIMEOUT");
  });

  it("cancels when the caller aborts, without retrying", async () => {
    mock.script("POST /chat/completions", { hang: true });
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 100);
    const e = await caught(chatCompletion(cfg(), { ...chat, signal: abort.signal }));
    expect(e.category).toBe("CANCELLED");
    expect(mock.seen).toHaveLength(1);
  });

  it("reports an incomplete completion as BAD_RESPONSE", async () => {
    mock.script("POST /chat/completions", { status: 200, json: { choices: [] } });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("BAD_RESPONSE");
    mock.script("POST /chat/completions", { status: 200, json: "not json" });
    expect((await caught(chatCompletion(cfg(), chat))).category).toBe("BAD_RESPONSE");
  });

  it("refuses plain http to a non-local host and URLs with credentials", async () => {
    await expect(fetchLimits(cfg({ baseUrl: "http://coarena.ai/api/v1" }))).rejects.toMatchObject({ category: "NOT_CONFIGURED" });
    await expect(fetchLimits(cfg({ baseUrl: "https://u:p@coarena.ai/api/v1" }))).rejects.toMatchObject({ category: "NOT_CONFIGURED" });
  });
});
