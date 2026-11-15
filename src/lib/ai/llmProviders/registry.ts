import type { LlmProvider, LlmProviderModel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto/secretBox";
import type { Provider } from "@/lib/ai/providers";
import { COARENA_DEFAULT_BASE_URL, coarenaAdapter, type AdapterConfig, type ProviderAdapter } from "./coarena";
import { LlmProviderError, type LlmErrorCategory } from "./errors";

/**
 * Dynamic LLM providers (LlmProvider + LlmProviderModel rows), next to the
 * static code registry in providers.ts. The router reads enabled models
 * synchronously through getDynamicProviders(), served from an in-memory cache
 * refreshed from the database in the background, the same pattern as
 * providerConfig.ts. Admin writes call invalidateDynamicProviders().
 *
 * Keys: `credentialRef` is "env:<NAME>" (read from the server environment) or
 * an encrypted "enc:v1:…" value an admin saved. A key never leaves the
 * server: Provider objects built here carry no key, and admin responses only
 * get maskKey().
 */
export const COARENA_ID = "coarena";

/** Current Coarena catalogue (2026-11-14), used to seed the table before the first sync and in tests. Sync replaces it with whatever /models returns. */
export const COARENA_BOOTSTRAP_MODELS = [
  "claude-fable-5", "claude-fable-5-1", "claude-fable-5-2", "claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5",
  "deepseek-v4-1-flash-1017", "gemini-3-8-flash", "gemini-4-argon", "gemini-4-carbon", "glm-5-3-flash",
  "gpt-6-1-sol", "gpt-6-1-terra", "gpt-6-astra", "gpt-6-luna", "grok-4-7", "hy4", "kimi-k3", "kimi-k3-1-pro",
  "mimo-v2-6-pro", "minimax-m3-1-flash", "qwen3-8-2-4t-a95b",
];

const ADAPTERS: Record<string, ProviderAdapter> = { coarena: coarenaAdapter };

export function adapterFor(row: Pick<LlmProvider, "adapter">): ProviderAdapter {
  const adapter = ADAPTERS[row.adapter];
  if (!adapter) throw new LlmProviderError(row.adapter, "NOT_CONFIGURED");
  return adapter;
}

/** Creates the Coarena row (disabled) and seeds its catalogue once. Idempotent. */
export async function ensureProviders(): Promise<void> {
  const existing = await prisma.llmProvider.findUnique({ where: { id: COARENA_ID } });
  if (existing) return;
  await prisma.llmProvider.upsert({
    where: { id: COARENA_ID },
    update: {},
    create: { id: COARENA_ID, name: "Coarena", adapter: "coarena", baseUrl: process.env.COARENA_BASE_URL || COARENA_DEFAULT_BASE_URL, credentialRef: "env:COARENA_API_KEY", enabled: false },
  });
  if ((await prisma.llmProviderModel.count({ where: { providerId: COARENA_ID } })) === 0) {
    await prisma.llmProviderModel.createMany({ data: COARENA_BOOTSTRAP_MODELS.map((externalId) => ({ providerId: COARENA_ID, externalId, displayName: externalId, enabled: false, available: true })) });
  }
}

const ENV_REF = /^env:([A-Z][A-Z0-9_]{1,63})$/;

/** The usable key for a provider, or null when none is configured. Server-side only. */
export function resolveKey(row: Pick<LlmProvider, "credentialRef">): string | null {
  const ref = row.credentialRef;
  const env = ENV_REF.exec(ref);
  if (env) return process.env[env[1]]?.trim() || null;
  if (isEncrypted(ref)) {
    try { return decryptSecret(ref) || null; } catch { return null; }
  }
  return null; // anything else is not a supported reference (never plaintext)
}

/** Masked display: where the key comes from and its last four characters. Never the key. */
export function maskKey(row: Pick<LlmProvider, "credentialRef" | "keyHint">): { source: "env" | "vault" | "none"; envName: string | null; masked: string | null } {
  const env = ENV_REF.exec(row.credentialRef);
  if (env) {
    const value = process.env[env[1]]?.trim();
    return { source: value ? "env" : "none", envName: env[1], masked: value && value.length >= 12 ? "••••••••" + value.slice(-4) : value ? "••••••••" : null };
  }
  if (isEncrypted(row.credentialRef)) return { source: "vault", envName: null, masked: "••••••••" + (row.keyHint ?? "") };
  return { source: "none", envName: null, masked: null };
}

export function adapterConfig(row: Pick<LlmProvider, "baseUrl" | "credentialRef" | "timeoutMs">): AdapterConfig {
  return { baseUrl: row.baseUrl, apiKey: resolveKey(row) ?? "", timeoutMs: row.timeoutMs };
}

// ─── Router-facing cache ─────────────────────────────────────────────────────

export interface DynamicEntry { provider: LlmProvider; model: LlmProviderModel; key: string }
const CACHE_TTL_MS = 30_000;
let entries = new Map<string, DynamicEntry>();
let providersCache: Provider[] = [];
let loadedAt = 0;
let inflight: Promise<void> | null = null;

export const dynamicKey = (providerId: string, externalId: string) => `${providerId}:${externalId}`;

function toProvider(p: LlmProvider, m: LlmProviderModel): Provider {
  const key = dynamicKey(p.id, m.externalId);
  const ceiling = Math.min(m.maxOutputTokens ?? 16_384, p.maxOutputTokens ?? Number.MAX_SAFE_INTEGER);
  return {
    id: key,
    name: `${m.displayName} · ${p.name}`,
    provider: p.adapter,
    model: key,
    baseURL: p.baseUrl,
    apiKey: "",
    strengths: ["general"],
    maxTokens: Math.min(4096, ceiling),
    maxOutputCeiling: ceiling,
    creditCost: m.creditCost ?? p.defaultCreditCost,
    firstTokenTimeoutMs: Math.min(Math.max(p.timeoutMs, 8_000), 120_000),
    dynamic: { providerId: p.id, externalId: m.externalId, fallbackEligible: p.autoRouting && p.defaultModelId === m.externalId, fallbackOnError: p.fallbackEnabled, configured: true },
  };
}

async function load(): Promise<void> {
  try {
    const rows = await prisma.llmProvider.findMany({ where: { enabled: true }, include: { models: { where: { enabled: true, available: true }, orderBy: [{ priority: "asc" }, { externalId: "asc" }] } } });
    const next = new Map<string, DynamicEntry>();
    const list: Provider[] = [];
    for (const p of rows) {
      if (!resolveKey(p)) continue; // no key: nothing of this provider is usable
      const { models, ...provider } = p;
      for (const m of models) {
        const key = dynamicKey(p.id, m.externalId);
        next.set(key, { provider: provider as LlmProvider, model: m, key });
        list.push(toProvider(provider as LlmProvider, m));
      }
    }
    entries = next;
    providersCache = list;
    loadedAt = Date.now();
  } catch (err) {
    // Keep the last known list: a DB blip must not switch models on or off.
    console.error("[llm-registry] refresh failed:", err instanceof Error ? err.message : "unknown");
  }
}

export async function refreshDynamicProviders(force = false): Promise<void> {
  if (!force && loadedAt && Date.now() - loadedAt < CACHE_TTL_MS) return;
  if (!inflight) inflight = load().finally(() => { inflight = null; });
  await inflight;
}

/** Enabled, available, keyed models as router Providers. Synchronous; refreshes in the background when stale. */
export function getDynamicProviders(): Provider[] {
  if (Date.now() - loadedAt > CACHE_TTL_MS) void refreshDynamicProviders();
  return providersCache;
}

export function dynamicEntry(key: string): DynamicEntry | undefined {
  return entries.get(key);
}

export function invalidateDynamicProviders(): Promise<void> {
  loadedAt = 0;
  return refreshDynamicProviders(true);
}

// ─── Jobs: sync, health, provider-reported usage ─────────────────────────────

/**
 * One runner at a time per job name, across requests and cron overlaps
 * (SiteSetting row as a lease; SQLite serializes the check-and-take).
 * Returns null when another run holds the lease.
 */
export async function withLease<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
  const key = `llm_lease:${name}`;
  const now = Date.now();
  const taken = await prisma.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key } });
    if (row && Number(row.value) > now) return false;
    await tx.siteSetting.upsert({ where: { key }, create: { key, value: String(now + ttlMs) }, update: { value: String(now + ttlMs) } });
    return true;
  });
  if (!taken) return null;
  try { return await fn(); }
  finally { await prisma.siteSetting.update({ where: { key }, data: { value: "0" } }).catch(() => {}); }
}

const categoryOf = (e: unknown): LlmErrorCategory => (e instanceof LlmProviderError ? e.category : "NETWORK");

export interface SyncResult { ok: boolean; added: number; updated: number; unavailable: number; error: LlmErrorCategory | null; skipped?: boolean }

/**
 * Pulls /models and reconciles: new models are added disabled, known models
 * get the provider's latest details, and models no longer listed become
 * unavailable (never deleted). Admin choices (enabled, priority, credit cost,
 * caps) are left alone. An empty or unreadable list changes nothing.
 */
export async function syncModels(providerId: string): Promise<SyncResult> {
  const result = await withLease(`sync:${providerId}`, 120_000, async (): Promise<SyncResult> => {
    const provider = await prisma.llmProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new LlmProviderError(providerId, "NOT_CONFIGURED");
    try {
      const models = await adapterFor(provider).listModels(adapterConfig(provider));
      if (!models.length) throw new LlmProviderError(provider.name, "BAD_RESPONSE");
      const now = new Date();
      const known = new Set((await prisma.llmProviderModel.findMany({ where: { providerId }, select: { externalId: true } })).map((m) => m.externalId));
      let added = 0, updated = 0;
      await prisma.$transaction(async (tx) => {
        for (const m of models) {
          const details = { displayName: m.displayName, description: m.description, lifecycle: m.lifecycle, vision: m.vision, tools: m.tools, streaming: m.streaming, contextWindow: m.contextWindow, maxOutputTokens: m.maxOutputTokens, metadata: JSON.stringify(m.metadata), available: true, lastSyncedAt: now };
          await tx.llmProviderModel.upsert({ where: { providerId_externalId: { providerId, externalId: m.externalId } }, update: details, create: { providerId, externalId: m.externalId, enabled: false, ...details } });
          if (known.has(m.externalId)) updated++; else added++;
        }
        await tx.llmProvider.update({ where: { id: providerId }, data: { lastSyncAt: now, lastSyncError: null } });
      });
      const gone = await prisma.llmProviderModel.updateMany({ where: { providerId, externalId: { notIn: models.map((m) => m.externalId) }, available: true }, data: { available: false } });
      await invalidateDynamicProviders();
      return { ok: true, added, updated, unavailable: gone.count, error: null };
    } catch (e) {
      const error = categoryOf(e);
      await prisma.llmProvider.update({ where: { id: providerId }, data: { lastSyncAt: new Date(), lastSyncError: error } }).catch(() => {});
      return { ok: false, added: 0, updated: 0, unavailable: 0, error };
    }
  });
  return result ?? { ok: false, added: 0, updated: 0, unavailable: 0, error: null, skipped: true };
}

export type HealthStatus = "HEALTHY" | "DEGRADED" | "OFFLINE" | "UNKNOWN";
export function healthFor(category: LlmErrorCategory | null): HealthStatus {
  if (!category) return "HEALTHY";
  if (category === "RATE_LIMIT" || category === "QUOTA" || category === "TIMEOUT") return "DEGRADED";
  return "OFFLINE";
}

/** Lightweight, free check (GET /limits). Stores the status and a safe error code. */
export async function checkHealth(providerId: string): Promise<{ status: HealthStatus; latencyMs: number | null; error: LlmErrorCategory | null }> {
  const provider = await prisma.llmProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new LlmProviderError(providerId, "NOT_CONFIGURED");
  let error: LlmErrorCategory | null = null, latencyMs: number | null = null;
  try { latencyMs = (await adapterFor(provider).testConnection(adapterConfig(provider))).latencyMs; }
  catch (e) { error = categoryOf(e); }
  const status = healthFor(error);
  await prisma.llmProvider.update({ where: { id: providerId }, data: { healthStatus: status, lastHealthAt: new Date(), lastError: error } });
  return { status, latencyMs, error };
}

const SNAPSHOT_MAX_AGE_MS = 2 * 60_000;

/**
 * Provider-reported limits and usage, cached: a fresh snapshot (default under
 * 2 minutes old) is returned as is, so opening the admin page repeatedly does
 * not multiply upstream calls. Stores only normalized fields.
 */
export async function refreshSnapshot(providerId: string, maxAgeMs = SNAPSHOT_MAX_AGE_MS) {
  const latest = await prisma.llmProviderSnapshot.findFirst({ where: { providerId }, orderBy: { fetchedAt: "desc" } });
  if (latest && Date.now() - latest.fetchedAt.getTime() < maxAgeMs) return latest;
  const fresh = await withLease(`usage:${providerId}`, 60_000, async () => {
    const provider = await prisma.llmProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new LlmProviderError(providerId, "NOT_CONFIGURED");
    const adapter = adapterFor(provider), cfg = adapterConfig(provider);
    try {
      const [limits, usage] = await Promise.all([adapter.fetchLimits(cfg), adapter.fetchUsage(cfg, "24h").catch(() => null)]);
      return prisma.llmProviderSnapshot.create({
        data: {
          providerId,
          status: "OK",
          creditRemainingUsd: limits.leftTodayUsd,
          usedTodayUsd: limits.usedTodayUsd ?? usage?.today.spentUsd ?? null,
          dailyLimitUsd: limits.usdPerDay,
          requestsToday: limits.requestsToday ?? usage?.today.requests ?? null,
          requestsLeft: limits.requestsLeft,
          dailyRequestLimit: limits.requestsPerDay,
          resetAt: limits.resetsAt ? new Date(limits.resetsAt) : usage?.today.resetsAt ? new Date(usage.today.resetsAt) : null,
          data: JSON.stringify({ limits, usage }),
        },
      });
    } catch (e) {
      return prisma.llmProviderSnapshot.create({ data: { providerId, status: "ERROR", error: categoryOf(e) } });
    }
  });
  // Keep a week of snapshots; older ones are only history noise.
  void prisma.llmProviderSnapshot.deleteMany({ where: { providerId, fetchedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } }).catch(() => {});
  return fresh ?? latest;
}
