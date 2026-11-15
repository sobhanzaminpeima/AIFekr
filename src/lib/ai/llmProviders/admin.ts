import type { LlmProvider, LlmProviderModel, LlmProviderSnapshot } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { encryptSecret } from "@/lib/crypto/secretBox";
import { assertPublicHttpUrl } from "@/lib/net/safeUrl";
import { PROVIDERS } from "@/lib/ai/providers";
import { utcDay } from "./limits";
import { dynamicKey, ensureProviders, invalidateDynamicProviders, maskKey } from "./registry";

/**
 * Admin side of LLM Management for dynamic providers: role checks, audit,
 * safe views (a key is only ever shown masked), settings validation and the
 * usage dashboard aggregation over the unified ledger.
 */
export type AdminUser = { id: string; role: string };

export async function requireLlmAdmin(req: NextRequest): Promise<AdminUser | NextResponse> {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return unauthorizedResponse(req);
  return user as AdminUser;
}

export async function audit(actor: AdminUser, action: string, targetId: string | null, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId: actor.id, action, targetId, metadata: JSON.stringify(metadata) } }).catch(() => {});
}

/** Snapshots older than this are labelled stale in the dashboard. */
export const SNAPSHOT_STALE_MS = 15 * 60_000;

export function snapshotView(s: LlmProviderSnapshot | null) {
  if (!s) return null;
  let data: unknown = null;
  try { data = s.data ? JSON.parse(s.data) : null; } catch { data = null; }
  return {
    status: s.status,
    error: s.error,
    creditRemainingUsd: s.creditRemainingUsd,
    usedTodayUsd: s.usedTodayUsd,
    dailyLimitUsd: s.dailyLimitUsd,
    usedPercent: s.usedTodayUsd != null && s.dailyLimitUsd ? Math.min(100, Math.round((s.usedTodayUsd / s.dailyLimitUsd) * 1000) / 10) : null,
    requestsToday: s.requestsToday,
    requestsLeft: s.requestsLeft,
    dailyRequestLimit: s.dailyRequestLimit,
    resetAt: s.resetAt,
    fetchedAt: s.fetchedAt,
    stale: Date.now() - s.fetchedAt.getTime() > SNAPSHOT_STALE_MS,
    data,
  };
}

const todayStart = () => new Date(utcDay() + "T00:00:00.000Z");

/** Today's ledger figures per model key, for the models table. */
async function todayByModel(providerId: string) {
  const since = todayStart();
  const [byStatus, byUser] = await Promise.all([
    prisma.llmUsageEvent.groupBy({ by: ["modelId", "status"], where: { providerId, startedAt: { gte: since } }, _count: { _all: true }, _sum: { totalTokens: true } }),
    prisma.llmUsageEvent.groupBy({ by: ["modelId", "userId"], where: { providerId, startedAt: { gte: since }, userId: { not: null } } }),
  ]);
  const out = new Map<string, { requests: number; errors: number; tokens: number; users: number }>();
  for (const g of byStatus) {
    const row = out.get(g.modelId) ?? { requests: 0, errors: 0, tokens: 0, users: 0 };
    if (g.status !== "BLOCKED") row.requests += g._count._all;
    if (g.status === "ERROR" || g.status === "BLOCKED") row.errors += g._count._all;
    row.tokens += g._sum.totalTokens ?? 0;
    out.set(g.modelId, row);
  }
  for (const g of byUser) { const row = out.get(g.modelId); if (row) row.users += 1; }
  return out;
}

function modelView(p: LlmProvider, m: LlmProviderModel, today: Map<string, { requests: number; errors: number; tokens: number; users: number }>) {
  let meta: { ownedBy?: string | null; aliases?: string[]; efforts?: string[]; deprecatedAt?: string | null; retiresAt?: string | null } = {};
  try { meta = m.metadata ? JSON.parse(m.metadata) : {}; } catch { meta = {}; }
  const key = dynamicKey(p.id, m.externalId);
  const t = today.get(key) ?? { requests: 0, errors: 0, tokens: 0, users: 0 };
  return {
    id: m.id, key, externalId: m.externalId, displayName: m.displayName, description: m.description,
    enabled: m.enabled, available: m.available, lifecycle: m.lifecycle, isDefault: p.defaultModelId === m.externalId,
    vision: m.vision, tools: m.tools, streaming: m.streaming, contextWindow: m.contextWindow, maxOutputTokens: m.maxOutputTokens,
    priority: m.priority, creditCost: m.creditCost, effectiveCreditCost: m.creditCost ?? p.defaultCreditCost, dailyRequestCap: m.dailyRequestCap,
    ownedBy: meta.ownedBy ?? null, deprecatedAt: meta.deprecatedAt ?? null, retiresAt: meta.retiresAt ?? null,
    lastSyncedAt: m.lastSyncedAt, today: t,
  };
}

export async function providerView(p: LlmProvider & { models: LlmProviderModel[] }) {
  const [snapshot, today] = await Promise.all([
    prisma.llmProviderSnapshot.findFirst({ where: { providerId: p.id }, orderBy: { fetchedAt: "desc" } }),
    todayByModel(p.id),
  ]);
  const key = maskKey(p);
  return {
    id: p.id, name: p.name, adapter: p.adapter, baseUrl: p.baseUrl, enabled: p.enabled,
    key: { configured: key.source !== "none", source: key.source, envName: key.envName, masked: key.masked },
    healthStatus: p.healthStatus, lastHealthAt: p.lastHealthAt, lastSyncAt: p.lastSyncAt, lastSyncError: p.lastSyncError, lastError: p.lastError,
    timeoutMs: p.timeoutMs, defaultModelId: p.defaultModelId, defaultCreditCost: p.defaultCreditCost,
    limits: { dailyRequestCap: p.dailyRequestCap, perUserDailyCap: p.perUserDailyCap, maxOutputTokens: p.maxOutputTokens, maxConcurrency: p.maxConcurrency, softWarnPercent: p.softWarnPercent, hardStopPercent: p.hardStopPercent },
    fallbackEnabled: p.fallbackEnabled, autoRouting: p.autoRouting,
    snapshot: snapshotView(snapshot),
    models: p.models.map((m) => modelView(p, m, today)),
  };
}

export async function listProviderViews() {
  await ensureProviders();
  const rows = await prisma.llmProvider.findMany({ orderBy: { name: "asc" }, include: { models: { orderBy: [{ available: "desc" }, { priority: "asc" }, { externalId: "asc" }] } } });
  return Promise.all(rows.map(providerView));
}

const capInt = (max: number) => z.number().int().min(0).max(max).nullable();
export const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().max(300).optional(),
  timeoutMs: z.number().int().min(5_000).max(300_000).optional(),
  defaultModelId: z.string().trim().max(128).nullable().optional(),
  defaultCreditCost: z.number().int().min(0).max(1000).optional(),
  dailyRequestCap: capInt(10_000_000).optional(),
  perUserDailyCap: capInt(1_000_000).optional(),
  maxOutputTokens: z.number().int().min(16).max(200_000).nullable().optional(),
  maxConcurrency: z.number().int().min(1).max(1000).nullable().optional(),
  softWarnPercent: z.number().int().min(1).max(100).optional(),
  hardStopPercent: z.number().int().min(1).max(200).optional(),
  fallbackEnabled: z.boolean().optional(),
  autoRouting: z.boolean().optional(),
  /** Write-only. Encrypted at rest; never returned. */
  apiKey: z.string().trim().min(12).max(400).regex(/^[\x21-\x7e]+$/).optional(),
  /** Forget a saved key and read COARENA_API_KEY from the server environment again. */
  clearKey: z.literal(true).optional(),
}).strict();
export type SettingsInput = z.infer<typeof settingsSchema>;

export class SettingsError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}

/** https only (http just for localhost outside production) and never a private address. */
export async function validateBaseUrl(raw: string): Promise<string> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new SettingsError("INVALID_BASE_URL"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local && process.env.NODE_ENV !== "production" && url.protocol === "http:") return url.toString().replace(/\/+$/, "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new SettingsError("INVALID_BASE_URL");
  try { await assertPublicHttpUrl(url.toString()); } catch { throw new SettingsError("UNSAFE_BASE_URL"); }
  return url.toString().replace(/\/+$/, "");
}

/** Applies validated settings; returns the names of the fields that changed (for the audit log). */
export async function saveSettings(actor: AdminUser, providerId: string, input: SettingsInput): Promise<string[]> {
  const row = await prisma.llmProvider.findUnique({ where: { id: providerId }, include: { models: true } });
  if (!row) throw new SettingsError("PROVIDER_NOT_FOUND", 404);
  if ((input.apiKey || input.clearKey) && actor.role !== "SUPER_ADMIN") throw new SettingsError("SUPER_ADMIN_REQUIRED", 403);
  if (input.apiKey && input.clearKey) throw new SettingsError("KEY_CONFLICT");
  const data: Record<string, unknown> = {};
  for (const k of ["enabled", "timeoutMs", "defaultCreditCost", "dailyRequestCap", "perUserDailyCap", "maxOutputTokens", "maxConcurrency", "softWarnPercent", "hardStopPercent", "fallbackEnabled", "autoRouting"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  if (input.baseUrl !== undefined) data.baseUrl = await validateBaseUrl(input.baseUrl);
  if (input.defaultModelId !== undefined) {
    if (input.defaultModelId !== null && !row.models.some((m) => m.externalId === input.defaultModelId && m.available)) throw new SettingsError("UNKNOWN_MODEL");
    data.defaultModelId = input.defaultModelId;
  }
  if (input.softWarnPercent !== undefined || input.hardStopPercent !== undefined) {
    const soft = input.softWarnPercent ?? row.softWarnPercent, hard = input.hardStopPercent ?? row.hardStopPercent;
    if (soft > hard) throw new SettingsError("SOFT_ABOVE_HARD");
  }
  if (input.apiKey) { data.credentialRef = encryptSecret(input.apiKey); data.keyHint = input.apiKey.slice(-4); data.healthStatus = "UNKNOWN"; }
  if (input.clearKey) { data.credentialRef = `env:${row.adapter.toUpperCase()}_API_KEY`; data.keyHint = null; data.healthStatus = "UNKNOWN"; }
  const changed = Object.keys(data).filter((k) => !["keyHint", "healthStatus"].includes(k)).map((k) => (k === "credentialRef" ? (input.clearKey ? "apiKey:cleared" : "apiKey:replaced") : k));
  if (!changed.length) return [];
  await prisma.llmProvider.update({ where: { id: providerId }, data });
  // Values are recorded except the key itself (only that it changed).
  const recorded = Object.fromEntries(Object.entries(data).filter(([k]) => !["credentialRef", "keyHint", "healthStatus"].includes(k)));
  await audit(actor, "llm.provider_settings", providerId, { changed, values: recorded });
  await invalidateDynamicProviders();
  return changed;
}

export const modelsPatchSchema = z.object({
  ids: z.array(z.string().min(1).max(128)).min(1).max(500),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  creditCost: z.number().int().min(0).max(1000).nullable().optional(),
  dailyRequestCap: capInt(10_000_000).optional(),
  makeDefault: z.literal(true).optional(),
}).strict();

export async function patchModels(actor: AdminUser, providerId: string, input: z.infer<typeof modelsPatchSchema>) {
  const models = await prisma.llmProviderModel.findMany({ where: { providerId, externalId: { in: input.ids } } });
  if (models.length !== new Set(input.ids).size) throw new SettingsError("UNKNOWN_MODEL", 404);
  if (input.enabled === true && models.some((m) => !m.available)) throw new SettingsError("MODEL_UNAVAILABLE");
  if (input.makeDefault && (input.ids.length !== 1 || !models[0].available)) throw new SettingsError("DEFAULT_NEEDS_ONE_AVAILABLE_MODEL");
  const data: Record<string, unknown> = {};
  for (const k of ["enabled", "priority", "creditCost", "dailyRequestCap"] as const) if (input[k] !== undefined) data[k] = input[k];
  if (input.makeDefault) data.enabled = true; // a default that cannot be used would be misleading
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.llmProviderModel.updateMany({ where: { providerId, externalId: { in: input.ids } }, data });
    if (input.makeDefault) await tx.llmProvider.update({ where: { id: providerId }, data: { defaultModelId: input.ids[0] } });
    if (input.enabled === false) {
      const provider = await tx.llmProvider.findUnique({ where: { id: providerId } });
      if (provider?.defaultModelId && input.ids.includes(provider.defaultModelId)) await tx.llmProvider.update({ where: { id: providerId }, data: { defaultModelId: null } });
    }
  });
  await audit(actor, "llm.models_updated", providerId, { ids: input.ids.slice(0, 50), count: input.ids.length, ...data, ...(input.makeDefault ? { default: input.ids[0] } : {}) });
  await invalidateDynamicProviders();
}

// ─── Usage & Credits dashboard ───────────────────────────────────────────────

export const usageQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d", "custom"]).default("today"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  providerId: z.string().max(80).optional(),
  modelId: z.string().max(160).optional(),
  userId: z.string().max(64).optional(),
  status: z.enum(["SUCCESS", "ERROR", "CANCELLED", "BLOCKED"]).optional(),
});

export function rangeOf(q: z.infer<typeof usageQuerySchema>): { from: Date; to: Date } {
  const to = q.range === "custom" && q.to ? new Date(q.to) : new Date();
  if (q.range === "custom") {
    if (!q.from) throw new SettingsError("FROM_REQUIRED");
    const from = new Date(q.from);
    if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) throw new SettingsError("INVALID_RANGE");
    return { from, to };
  }
  if (q.range === "today") return { from: todayStart(), to };
  return { from: new Date(to.getTime() - (q.range === "7d" ? 7 : 30) * 86_400_000), to };
}

const providerNames = (): Map<string, string> => new Map(PROVIDERS.map((p) => [p.id, p.name]));

export async function usageDashboard(q: z.infer<typeof usageQuerySchema>) {
  const { from, to } = rangeOf(q);
  const where = {
    startedAt: { gte: from, lte: to },
    ...(q.providerId ? { providerId: q.providerId } : {}),
    ...(q.modelId ? { modelId: q.modelId } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };
  const sums = { inputTokens: true, outputTokens: true, totalTokens: true, reportedCostUsd: true, estimatedCostUsd: true } as const;
  const [byProvider, byModel, modelUsers, registered] = await Promise.all([
    prisma.llmUsageEvent.groupBy({ by: ["providerId", "status"], where, _count: { _all: true }, _sum: sums, _avg: { latencyMs: true }, _max: { startedAt: true } }),
    prisma.llmUsageEvent.groupBy({ by: ["providerId", "modelId", "status"], where, _count: { _all: true }, _sum: sums, _avg: { latencyMs: true } }),
    prisma.llmUsageEvent.groupBy({ by: ["modelId", "userId"], where: { ...where, userId: q.userId ?? { not: null } } }),
    prisma.llmProvider.findMany(),
  ]);
  const names = providerNames();
  for (const r of registered) names.set(r.id, r.name);

  type Agg = { requests: number; success: number; errors: number; cancelled: number; blocked: number; inputTokens: number; outputTokens: number; totalTokens: number; reportedCostUsd: number | null; estimatedCostUsd: number | null; latencySum: number; latencyN: number };
  const empty = (): Agg => ({ requests: 0, success: 0, errors: 0, cancelled: 0, blocked: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, reportedCostUsd: null, estimatedCostUsd: null, latencySum: 0, latencyN: 0 });
  const add = (a: Agg, g: { status: string; _count: { _all: number }; _sum: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; reportedCostUsd: number | null; estimatedCostUsd: number | null }; _avg: { latencyMs: number | null } }) => {
    const n = g._count._all;
    if (g.status === "BLOCKED") a.blocked += n; else a.requests += n;
    if (g.status === "SUCCESS") a.success += n;
    if (g.status === "ERROR") a.errors += n;
    if (g.status === "CANCELLED") a.cancelled += n;
    a.inputTokens += g._sum.inputTokens ?? 0;
    a.outputTokens += g._sum.outputTokens ?? 0;
    a.totalTokens += g._sum.totalTokens ?? 0;
    if (g._sum.reportedCostUsd != null) a.reportedCostUsd = (a.reportedCostUsd ?? 0) + g._sum.reportedCostUsd;
    if (g._sum.estimatedCostUsd != null) a.estimatedCostUsd = (a.estimatedCostUsd ?? 0) + g._sum.estimatedCostUsd;
    if (g._avg.latencyMs != null && g.status !== "BLOCKED") { a.latencySum += g._avg.latencyMs * n; a.latencyN += n; }
  };
  const finish = (a: Agg) => {
    const { latencySum, latencyN, ...rest } = a;
    return { ...rest, avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null, successRate: a.requests ? Math.round((a.success / a.requests) * 1000) / 10 : null };
  };

  const providers = new Map<string, Agg & { lastAt: Date | null }>();
  for (const g of byProvider) {
    const a = providers.get(g.providerId) ?? { ...empty(), lastAt: null };
    add(a, g);
    if (g._max.startedAt && (!a.lastAt || g._max.startedAt > a.lastAt)) a.lastAt = g._max.startedAt;
    providers.set(g.providerId, a);
  }
  const models = new Map<string, Agg & { providerId: string; users: number }>();
  for (const g of byModel) {
    const a = models.get(g.modelId) ?? { ...empty(), providerId: g.providerId, users: 0 };
    add(a, g);
    models.set(g.modelId, a);
  }
  for (const u of modelUsers) { const m = models.get(u.modelId); if (m) m.users += 1; }

  // Registered dynamic providers always appear, with what they themselves reported.
  const snapshots = await Promise.all(registered.map((r) => prisma.llmProviderSnapshot.findFirst({ where: { providerId: r.id }, orderBy: { fetchedAt: "desc" } })));
  const reported = new Map(registered.map((r, i) => [r.id, snapshotView(snapshots[i])]));
  const ids = new Set<string>([...providers.keys(), ...(q.providerId ? [] : registered.map((r) => r.id))]);
  if (q.providerId) ids.add(q.providerId);

  return {
    range: { from, to, kind: q.range },
    generatedAt: new Date(),
    providers: [...ids].map((id) => {
      const a = providers.get(id);
      return {
        providerId: id,
        name: names.get(id) ?? id,
        dynamic: registered.some((r) => r.id === id),
        local: a ? { ...finish(a), lastEventAt: a.lastAt } : null,
        reported: reported.get(id) ?? null,
      };
    }).sort((x, y) => (y.local?.requests ?? 0) - (x.local?.requests ?? 0)),
    models: [...models.entries()].map(([modelId, a]) => ({ modelId, providerId: a.providerId, users: a.users, ...finish(a) })).sort((x, y) => y.requests - x.requests).slice(0, 300),
  };
}
