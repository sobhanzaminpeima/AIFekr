import type { ChatMessage, Provider, TokenUsage } from "@/lib/ai/providers";
import { logError } from "@/lib/logging/errorLog";
import { llmContext } from "./context";
import { LlmProviderError } from "./errors";
import { newRequestId, recordUsageEvent } from "./ledger";
import { acquireLimits } from "./limits";
import { adapterConfig, adapterFor, dynamicEntry, refreshDynamicProviders } from "./registry";

/**
 * Streams one chat answer through a dynamic provider model (Provider.dynamic).
 * Order matters: the model is re-checked against the live registry (a model
 * an admin just disabled is refused even if the caller held an old Provider
 * object), internal caps are taken before any upstream call, and exactly one
 * ledger row is written for the outcome.
 */
export async function streamDynamicProvider(
  provider: Provider,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  maxTokensOverride?: number,
  signal?: AbortSignal,
): Promise<TokenUsage | null> {
  await refreshDynamicProviders();
  const entry = dynamicEntry(provider.id);
  const name = provider.dynamic?.providerId ?? "provider";
  if (!entry) throw new LlmProviderError(name, "NOT_FOUND");
  const { provider: row, model } = entry;
  const ctx = llmContext();
  const requestId = newRequestId();
  const startedAt = new Date();
  const base = { requestId, providerId: row.id, modelId: entry.key, userId: ctx.userId ?? null, endpoint: "chat.completions", startedAt };

  let release: () => void;
  try {
    release = await acquireLimits(
      { providerId: row.id, modelKey: entry.key, userId: ctx.userId, providerName: row.name, dailyRequestCap: row.dailyRequestCap, modelDailyRequestCap: model.dailyRequestCap, perUserDailyCap: row.perUserDailyCap, maxConcurrency: row.maxConcurrency, softWarnPercent: row.softWarnPercent, hardStopPercent: row.hardStopPercent },
      (key, count, cap) => void logError({ source: "llm-limits (soft warning)", level: "warn", error: new Error(`${row.name} usage ${count}/${cap} for ${key.split(":").slice(0, -1).join(":")}`) }),
    );
  } catch (e) {
    await recordUsageEvent({ ...base, status: "BLOCKED", errorCategory: e instanceof LlmProviderError ? e.category : "LIMIT", metadata: { feature: ctx.feature } });
    throw e;
  }

  const ceiling = Math.min(model.maxOutputTokens ?? Number.MAX_SAFE_INTEGER, row.maxOutputTokens ?? Number.MAX_SAFE_INTEGER, provider.maxOutputCeiling ?? Number.MAX_SAFE_INTEGER);
  const maxTokens = Math.min(maxTokensOverride ?? provider.maxTokens, ceiling);
  let sawText = false;
  try {
    const result = await adapterFor(row).streamChat(adapterConfig(row), {
      model: model.externalId,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      maxTokens,
      temperature: 0.7,
      signal,
    }, (text) => { sawText = true; onChunk(text); });
    await recordUsageEvent({ ...base, status: "SUCCESS", upstreamRequestId: result.upstreamRequestId, inputTokens: result.usage?.promptTokens ?? null, outputTokens: result.usage?.completionTokens ?? null, totalTokens: result.usage?.totalTokens ?? null, reportedCostUsd: result.usage?.costUsd ?? null, metadata: { feature: ctx.feature, attempts: result.attempts, substitutedTo: result.substitutedTo } }, [entry.key, row.id]);
    return result.usage ? { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens } : null;
  } catch (e) {
    // The router aborts with STALL_TIMEOUT when the stream goes silent; that is a timeout, not a user cancel.
    const stalled = signal?.aborted && signal.reason instanceof Error && signal.reason.message === "STALL_TIMEOUT";
    const category = stalled ? "TIMEOUT" : signal?.aborted ? "CANCELLED" : e instanceof LlmProviderError ? e.category : "NETWORK";
    const err = e instanceof LlmProviderError && e.category === category ? e : new LlmProviderError(row.name, category, e instanceof LlmProviderError ? { status: e.status, upstreamCode: e.upstreamCode, upstreamRequestId: e.upstreamRequestId } : {});
    await recordUsageEvent({ ...base, status: category === "CANCELLED" ? "CANCELLED" : "ERROR", upstreamRequestId: err.upstreamRequestId, errorCategory: category, metadata: { feature: ctx.feature, upstreamCode: err.upstreamCode, partial: sawText } });
    throw err;
  } finally {
    release();
  }
}
