import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { LlmErrorCategory } from "./errors";

/**
 * Unified LLM usage ledger (LlmUsageEvent), for every provider. One row per
 * upstream attempt, keyed by a request id generated here, so a retried
 * bookkeeping write can never create a second row. Prompts and answers are
 * never stored; metadata is a small whitelist.
 *
 * A ledger failure must never fail or delay the user's answer, so writes
 * swallow their own errors.
 */
export type UsageStatus = "SUCCESS" | "ERROR" | "CANCELLED" | "BLOCKED";
export interface UsageEventInput {
  requestId?: string;
  providerId: string;
  modelId: string;
  userId?: string | null;
  upstreamRequestId?: string | null;
  endpoint: string;
  status: UsageStatus;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  reportedCostUsd?: number | null;
  startedAt: Date;
  finishedAt?: Date;
  errorCategory?: LlmErrorCategory | null;
  metadata?: { feature?: string | null; attempts?: number; substitutedTo?: string | null; upstreamCode?: string | null; partial?: boolean };
}

export const newRequestId = () => randomUUID();

const PRICE_TTL_MS = 60_000;
const priceCache = new Map<string, { at: number; value: { input: number | null; output: number | null } | null }>();

/** AiModelPricing for the exact model key first ("coarena:<model>"), then the provider ("coarena"). */
async function pricingFor(keys: string[]) {
  for (const key of keys) {
    const hit = priceCache.get(key);
    if (hit && Date.now() - hit.at < PRICE_TTL_MS) { if (hit.value) return hit.value; continue; }
    const row = await prisma.aiModelPricing.findUnique({ where: { providerId_kind: { providerId: key, kind: "chat" } } }).catch(() => null);
    const value = row && row.isActive ? { input: row.inputPricePerMillion, output: row.outputPricePerMillion } : null;
    priceCache.set(key, { at: Date.now(), value });
    if (value) return value;
  }
  return null;
}

/** Estimated USD from admin pricing; null when no price is set (unknown is not zero). */
export async function estimateCostUsd(priceKeys: string[], inputTokens: number | null | undefined, outputTokens: number | null | undefined): Promise<number | null> {
  if (inputTokens == null && outputTokens == null) return null;
  const price = await pricingFor(priceKeys);
  if (!price || (price.input == null && price.output == null)) return null;
  return ((inputTokens ?? 0) * (price.input ?? 0) + (outputTokens ?? 0) * (price.output ?? 0)) / 1_000_000;
}

export async function recordUsageEvent(e: UsageEventInput, priceKeys: string[] = [e.modelId, e.providerId]): Promise<void> {
  const requestId = e.requestId ?? newRequestId();
  const finishedAt = e.finishedAt ?? new Date();
  const success = e.status === "SUCCESS";
  const tokensKnown = success && (e.inputTokens != null || e.outputTokens != null);
  const total = tokensKnown ? e.totalTokens ?? (e.inputTokens ?? 0) + (e.outputTokens ?? 0) : null;
  try {
    // Failed and blocked calls carry no tokens or cost: nothing was billed.
    const estimated = tokensKnown ? await estimateCostUsd(priceKeys, e.inputTokens, e.outputTokens) : null;
    const meta = e.metadata ? Object.fromEntries(Object.entries(e.metadata).filter(([, v]) => v !== undefined && v !== null)) : null;
    await prisma.llmUsageEvent.upsert({
      where: { requestId },
      update: {},
      create: {
        requestId,
        providerId: e.providerId.slice(0, 80),
        modelId: e.modelId.slice(0, 160),
        userId: e.userId ?? null,
        upstreamRequestId: e.upstreamRequestId ?? null,
        endpoint: e.endpoint,
        status: e.status,
        inputTokens: tokensKnown ? e.inputTokens ?? null : null,
        outputTokens: tokensKnown ? e.outputTokens ?? null : null,
        totalTokens: total,
        reportedCostUsd: success ? e.reportedCostUsd ?? null : null,
        estimatedCostUsd: estimated,
        latencyMs: Math.max(0, finishedAt.getTime() - e.startedAt.getTime()),
        startedAt: e.startedAt,
        finishedAt,
        errorCategory: success ? null : e.errorCategory ?? null,
        metadata: meta && Object.keys(meta).length ? JSON.stringify(meta) : null,
      },
    });
  } catch (err) {
    console.error("[llm-ledger] write failed:", err instanceof Error ? err.message : "unknown");
  }
}
