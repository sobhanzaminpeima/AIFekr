import { describe, expect, it } from "vitest";
import { LlmProviderError, USER_MESSAGE_FA, categorize, parseRetryAfter, redactSecrets, retryDelay } from "./errors";
import { normalizeLimits, normalizeModels, normalizeUsage, normalizeUsageReport } from "./normalize";
import { isPersistentProviderError } from "../router";

describe("error mapping", () => {
  it("maps statuses and Coarena codes to categories", () => {
    expect(categorize(401, "invalid_api_key")).toBe("AUTH");
    expect(categorize(403, null)).toBe("FORBIDDEN");
    expect(categorize(404, "model_not_found")).toBe("NOT_FOUND");
    expect(categorize(408, null)).toBe("TIMEOUT");
    expect(categorize(504, "upstream_timeout")).toBe("TIMEOUT");
    expect(categorize(429, "rate_limit_exceeded")).toBe("RATE_LIMIT");
    expect(categorize(429, "concurrency_limit_exceeded")).toBe("RATE_LIMIT");
    expect(categorize(429, "insufficient_quota")).toBe("QUOTA");
    expect(categorize(503, "quota_unavailable")).toBe("QUOTA");
    expect(categorize(503, "server_busy")).toBe("UPSTREAM");
    expect(categorize(400, "model_off")).toBe("NOT_FOUND");
    expect(categorize(400, "context_length_exceeded")).toBe("INVALID");
  });

  it("keeps the router's persistent-error rules working", () => {
    expect(isPersistentProviderError(new LlmProviderError("Coarena", "AUTH", { status: 401 }))).toBe(true);
    expect(isPersistentProviderError(new LlmProviderError("Coarena", "QUOTA", { status: 429 }))).toBe(true);
    expect(isPersistentProviderError(new LlmProviderError("Coarena", "RATE_LIMIT", { status: 429 }))).toBe(false);
  });

  it("keeps only safe identifiers from upstream", () => {
    const e = new LlmProviderError("Coarena", "UPSTREAM", { status: 502, upstreamCode: "free text with spaces", upstreamRequestId: "req ok?" });
    expect(e.upstreamCode).toBeNull();
    expect(e.upstreamRequestId).toBeNull();
  });

  it("has a Persian message for every category", () => {
    for (const text of Object.values(USER_MESSAGE_FA)) expect(text).toMatch(/[؀-ۿ]/);
  });
});

describe("retry policy", () => {
  const err = (category: "RATE_LIMIT" | "AUTH" | "UPSTREAM", retryAfterMs: number | null = null) => new LlmProviderError("C", category, { retryAfterMs });
  it("backs off exponentially with full jitter inside the bounds", () => {
    expect(retryDelay(1, err("UPSTREAM"), undefined, () => 0)).toBe(200);
    expect(retryDelay(1, err("UPSTREAM"), undefined, () => 1)).toBe(400);
    expect(retryDelay(2, err("UPSTREAM"), undefined, () => 1)).toBe(800);
    expect(retryDelay(3, err("UPSTREAM"))).toBeNull(); // three attempts in all
  });
  it("honours Retry-After up to the cap and never retries permanent failures", () => {
    expect(retryDelay(1, err("RATE_LIMIT", 1500))).toBe(1500);
    expect(retryDelay(1, err("RATE_LIMIT", 30_000))).toBeNull();
    expect(retryDelay(1, err("AUTH"))).toBeNull();
  });
  it("reads Retry-After as seconds or an HTTP date", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter(new Date(Date.UTC(2026, 10, 14, 0, 0, 10)).toUTCString(), Date.UTC(2026, 10, 14, 0, 0, 0))).toBe(10_000);
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe("redaction", () => {
  it("removes keys and bearer tokens from text", () => {
    const key = "coa_live_abcdefghijklmnop";
    const out = redactSecrets(`failed with ${key} and Authorization: Bearer abcdefghijklmnopqrstuv`, [key]);
    expect(out).not.toContain(key);
    expect(out).not.toContain("abcdefghijklmnopqrstuv");
  });
});

describe("defensive parsing", () => {
  it("skips models without a usable id and survives missing fields", () => {
    const models = normalizeModels({ data: [{ id: "ok-1" }, { name: "no id" }, { id: "bad id with spaces" }, { id: "ok-1" }, null, "x"] });
    expect(models.map((m) => m.externalId)).toEqual(["ok-1"]);
    expect(models[0]).toMatchObject({ displayName: "ok-1", vision: false, contextWindow: null });
    expect(normalizeModels({})).toEqual([]);
    expect(normalizeModels(null)).toEqual([]);
  });
  it("reads usage in either token naming and treats absence as unknown", () => {
    expect(normalizeUsage({ input_tokens: 5, output_tokens: 2 })).toEqual({ promptTokens: 5, completionTokens: 2, totalTokens: 7, costUsd: null });
    expect(normalizeUsage({})).toBeNull();
    expect(normalizeUsage(undefined)).toBeNull();
  });
  it("returns nulls for a limits/usage payload whose schema changed", () => {
    const limits = normalizeLimits({ something: "else" });
    expect(Object.values(limits).every((v) => v === null)).toBe(true);
    const usage = normalizeUsageReport({ data: { today: "n/a", models: "x" } });
    expect(usage.today.requests).toBeNull();
    expect(usage.models).toEqual([]);
  });
});
