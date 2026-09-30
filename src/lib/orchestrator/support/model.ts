import type { ChatMessage, Provider } from "@/lib/ai/providers";
import { streamProvider } from "@/lib/ai/providers";
import { getEnabledProviders } from "@/lib/ai/router";

/**
 * Model selection for the floating support assistant (`support_mode`).
 *
 * Deliberately its own tiny router, not `routedStreamChat` from
 * `src/lib/ai/router.ts` -- that function's fallback chain walks *every*
 * enabled provider, Claude and GPT-5 included. The master prompt (§2.3) is
 * explicit that this assistant must add no new model cost, and per the
 * user's own decision it must never consume a credit. Reusing the main
 * router would mean that the moment every free provider is briefly
 * unavailable, a "where do I find X" question silently starts billing the
 * user for Claude -- exactly the failure mode this file exists to rule out.
 *
 * So: try free-tier providers, in order, and if none are usable, fail
 * loudly (`SupportModelUnavailableError`) rather than reach for a paid one.
 * `hasSupportModel()` lets a caller check this up front and return a clean
 * error before ever opening a response stream.
 */

/**
 * Mistral Medium first, not Large.
 *
 * Phase 3/4 reconciled this list to put Large first on the strength of an
 * independent design doc's recommendation (both this file and that doc took
 * "largest is safest" from the static provider list in providers.ts, without
 * either of us confirming it against the aggregator's own account). Checked
 * directly against FreeLLMAPI's live `/v1/models` on 2026-09-12 after a real
 * user got a Spanish answer to a Spanish question (see the postmortem in
 * systemPrompt.ts) and the production logs for that request showed
 * `mistral-large-3` failing with "Model 'mistral-large-3' is not in the
 * catalog" -- not rate-limited, not temporarily down, genuinely absent. Only
 * `mistral-medium-3.5` and `mistral-small-4` are in the live catalog. Same bug
 * class as the retired Groq and OpenAI-direct entries found earlier: a model
 * id that was never wrong in the code, just went stale underneath it.
 *
 * Then progressively smaller/different providers as a resilience chain, not a
 * further quality ladder. All of these are `creditCost: 1` on the free
 * FreeLLMAPI aggregator, or genuine free tiers (Groq, Cohere) -- see
 * src/lib/ai/providers.ts.
 */
export const FREE_PROVIDER_PRIORITY = ["free-mistral-medium-3-5", "free-mistral-small-4", "groq", "cohere"];

const PROVIDER_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function freeProvidersInPriorityOrder(): Provider[] {
  const enabled = new Map(getEnabledProviders().map((p) => [p.id, p]));
  return FREE_PROVIDER_PRIORITY.map((id) => enabled.get(id)).filter((p): p is Provider => !!p);
}

/** Whether at least one free-tier provider is currently enabled and configured. Check this before opening a response stream. */
export function hasSupportModel(): boolean {
  return freeProvidersInPriorityOrder().length > 0;
}

export class SupportModelUnavailableError extends Error {}

/**
 * Streams a support-assistant answer, trying free providers in order.
 *
 * If a provider fails after already streaming some text, `onFallback` fires
 * with `partial: true` -- the same contract `routedStreamChat`'s
 * `onFallback` uses -- so a caller can reset whatever partial text it
 * already showed before the next provider's answer arrives, rather than
 * concatenating two half-answers together.
 */
export async function streamSupportCompletion(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onFallback?: (info: { from: Provider; partial: boolean }) => void
): Promise<Provider> {
  const candidates = freeProvidersInPriorityOrder();
  if (candidates.length === 0) {
    throw new SupportModelUnavailableError(
      "No free-tier model is currently enabled for the support assistant (FreeLLMAPI/Groq/Cohere all missing or disabled) -- refusing to fall back to a paid model."
    );
  }

  let lastError: Error | null = null;
  for (const provider of candidates) {
    let receivedAny = false;
    try {
      await withTimeout(
        streamProvider(provider, messages, systemPrompt, (text) => {
          receivedAny = true;
          onChunk(text);
        }),
        PROVIDER_TIMEOUT_MS,
        `Timeout: ${provider.name} produced no complete response within ${PROVIDER_TIMEOUT_MS / 1000}s`
      );
      return provider;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[SupportModel] ${provider.name} failed:`, lastError.message);
      onFallback?.({ from: provider, partial: receivedAny });
    }
  }

  throw new SupportModelUnavailableError(`Every free-tier support model failed. Last error: ${lastError?.message ?? "unknown"}`);
}
