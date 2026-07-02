/**
 * Provider-agnostic AI router with automatic fallback.
 *
 * Priority order is read from AI_PROVIDER_PRIORITY env var
 * (default: "claude,openai,gemini,deepseek").
 *
 * On error, timeout (>10 s to first token), or rate-limit the router
 * automatically tries the next provider and logs the event to
 * ProviderFallbackLog for visibility in the admin panel.
 */

import {
  getProviderRegistry,
  getPriorityList,
  type ChatMessage,
  type StreamOptions,
  type AIProvider,
} from "./providers/index";

const FIRST_TOKEN_TIMEOUT_MS = 10_000; // 10 seconds

// ── Fallback logging ────────────────────────────────────────────────────────

async function logFallback(
  fromProvider: string,
  toProvider: string | null,
  reason: string,
  category: string
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    await (prisma as any).providerFallbackLog.create({
      data: { fromProvider, toProvider, reason: reason.slice(0, 500), category },
    });
  } catch (e) {
    // Non-fatal — log to console so builds without migrations still work
    console.error("[Router] Failed to write fallback log:", e);
  }
}

// ── Category detection ──────────────────────────────────────────────────────

function detectCategory(message: string): string {
  const lower = message.toLowerCase();
  if (/\bcode\b|function|class|def |import |error|bug|debug|python|javascript|typescript|react|node/.test(lower))
    return "code";
  if (/math|equation|calculat|integral|derivative|formula|solve/.test(lower))
    return "math";
  if (/translat|ترجم|translate|english|persian|arabic|french/.test(lower))
    return "translation";
  if (/story|poem|creative|write a|imagine|fiction|narrative/.test(lower))
    return "creative";
  if (/business|strategy|market|revenue|startup|investor/.test(lower))
    return "business";
  if (/analyz|explain in detail|comprehensive|research|compare/.test(lower))
    return "complex";
  if (/quick|fast|brief|short|tldr|summary/.test(lower))
    return "fast";
  return "general";
}

// Category → preferred provider ids
const ROUTING_TABLE: Record<string, string[]> = {
  code:        ["deepseek", "openai", "claude"],
  math:        ["deepseek", "openai", "claude"],
  creative:    ["openai",   "claude", "gemini"],
  translation: ["gemini",   "openai", "deepseek"],
  business:    ["openai",   "claude", "gemini"],
  complex:     ["openai",   "claude", "gemini", "deepseek"],
  fast:        ["gemini",   "deepseek", "openai"],
  general:     ["claude",   "openai", "gemini", "deepseek"],
};

// ── Core streaming with first-token timeout ─────────────────────────────────

async function streamWithTimeout(
  provider: AIProvider,
  messages: ChatMessage[],
  options: StreamOptions,
  onChunk: (text: string) => void
): Promise<void> {
  const gen = provider.streamChat(messages, options);
  let firstToken = false;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      if (!firstToken)
        reject(new Error(`Timeout: no token within ${FIRST_TOKEN_TIMEOUT_MS / 1000}s`));
    }, FIRST_TOKEN_TIMEOUT_MS)
  );

  const streamPromise = (async () => {
    for await (const chunk of gen) {
      firstToken = true;
      onChunk(chunk);
    }
  })();

  await Promise.race([streamPromise, timeoutPromise]);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface RouterOptions extends StreamOptions {
  /** Override category detection */
  category?: string;
}

/**
 * Main entry point for all AI chat.
 * Tries providers in priority order; falls back automatically on any error.
 */
export async function routerStreamChat(
  messages: ChatMessage[],
  options: RouterOptions,
  onChunk: (text: string) => void,
  onProvider?: (provider: AIProvider) => void
): Promise<{ provider: AIProvider; category: string }> {
  const registry = await getProviderRegistry();
  const priorityList = getPriorityList();

  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const category = options.category ?? detectCategory(lastUserMsg);

  // Build ordered list: category preference → env priority → rest
  const categoryPreferred = ROUTING_TABLE[category] ?? ROUTING_TABLE.general;
  const raw = [
    ...categoryPreferred,
    ...priorityList.filter((id) => !categoryPreferred.includes(id)),
    ...registry
      .map((p) => p.id)
      .filter(
        (id) =>
          !categoryPreferred.includes(id) && !priorityList.includes(id)
      ),
  ];

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const orderedIds = raw.filter((id) => !seen.has(id) && seen.add(id));

  let lastError: Error | null = null;

  for (const id of orderedIds) {
    const provider = registry.find((p) => p.id === id);
    if (!provider || !provider.isHealthy()) continue;

    try {
      onProvider?.(provider);
      await streamWithTimeout(provider, messages, options, onChunk);
      provider.recordSuccess();
      return { provider, category };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      provider.recordFailure(error.message);

      console.warn(
        `[Router] ${provider.name} failed (${error.message.slice(0, 80)}), trying next…`
      );

      // Identify next healthy provider for the log
      const rest = orderedIds.slice(orderedIds.indexOf(id) + 1);
      const nextId =
        rest.find((nid) => {
          const np = registry.find((p) => p.id === nid);
          return np?.isHealthy();
        }) ?? null;

      await logFallback(provider.id, nextId, error.message, category);
    }
  }

  throw lastError ?? new Error("All AI providers failed or are unhealthy");
}

// ── Backward-compatible wrapper used by all existing API routes ─────────────

/** Legacy Provider shape expected by existing SSE routes */
export interface LegacyProvider {
  id: string;
  name: string;
  model: string;
  provider: string;
}

export async function routedStreamChat(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onProvider: (provider: LegacyProvider) => void,
  _model?: string
): Promise<void> {
  await routerStreamChat(messages, { systemPrompt }, onChunk, (p) =>
    onProvider({ id: p.id, name: p.name, model: p.id, provider: p.id })
  );
}
