import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who an LLM call is for, carried implicitly through the router so per-user
 * caps and the usage ledger can see it without changing every caller's
 * signature. Callers that know the user wrap their call in runWithLlmContext;
 * everything else simply has no user (per-user caps then do not apply).
 */
export interface LlmCallContext {
  userId?: string | null;
  feature?: string | null;
  /** Aborted when the user goes away (closed the chat); the router cancels the upstream call. */
  signal?: AbortSignal;
}
const storage = new AsyncLocalStorage<LlmCallContext>();

export function runWithLlmContext<T>(ctx: LlmCallContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
export function llmContext(): LlmCallContext {
  return storage.getStore() ?? {};
}
