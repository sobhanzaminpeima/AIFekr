import { prisma } from "@/lib/db/prisma";
import { LlmProviderError } from "./errors";

/**
 * Internal caps for dynamic providers, enforced before any upstream call.
 *
 * Day counters live in LlmUsageCounter and are incremented inside one
 * transaction. SQLite serializes write transactions, so two concurrent
 * requests can never both take the last slot: the loser's increment is rolled
 * back with its transaction. Concurrency is counted per process, which matches
 * the single Next.js process this app runs as.
 *
 * Hard stop: a cap is enforced at cap x hardStopPercent / 100 (100 = exactly
 * the cap). Soft warning: crossing cap x softWarnPercent / 100 is reported once
 * per counter per day through onSoftWarning.
 */
export interface LimitConfig {
  providerId: string;
  modelKey: string;
  userId?: string | null;
  dailyRequestCap?: number | null;
  modelDailyRequestCap?: number | null;
  perUserDailyCap?: number | null;
  maxConcurrency?: number | null;
  softWarnPercent?: number;
  hardStopPercent?: number;
  providerName?: string;
}

export class LlmLimitError extends LlmProviderError {
  readonly scope: "provider" | "model" | "user" | "concurrency";
  constructor(providerName: string, scope: LlmLimitError["scope"]) {
    super(providerName, "LIMIT");
    this.name = "LlmLimitError";
    this.scope = scope;
  }
}

const active = new Map<string, number>();
const warned = new Set<string>();

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

function effective(cap: number | null | undefined, percent: number): number | null {
  if (cap == null || cap < 0) return null;
  return Math.max(0, Math.floor((cap * percent) / 100));
}

/** Takes one request slot from every applicable cap, or throws LlmLimitError. Returns the release for the concurrency slot. */
export async function acquireLimits(cfg: LimitConfig, onSoftWarning?: (key: string, count: number, cap: number) => void): Promise<() => void> {
  const name = cfg.providerName ?? cfg.providerId;
  const hard = cfg.hardStopPercent ?? 100;
  const soft = cfg.softWarnPercent ?? 80;
  if (cfg.maxConcurrency && cfg.maxConcurrency > 0 && (active.get(cfg.providerId) ?? 0) >= cfg.maxConcurrency) throw new LlmLimitError(name, "concurrency");
  // Reserve the concurrency slot before the await below, so parallel calls see it.
  active.set(cfg.providerId, (active.get(cfg.providerId) ?? 0) + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const left = (active.get(cfg.providerId) ?? 1) - 1;
    if (left > 0) active.set(cfg.providerId, left); else active.delete(cfg.providerId);
  };

  const day = utcDay();
  const checks: { key: string; cap: number; raw: number; scope: LlmLimitError["scope"] }[] = [];
  const push = (key: string, raw: number | null | undefined, scope: LlmLimitError["scope"]) => {
    const cap = effective(raw, hard);
    if (cap !== null && raw != null) checks.push({ key, cap, raw, scope });
  };
  push(`provider:${cfg.providerId}:${day}`, cfg.dailyRequestCap, "provider");
  push(`model:${cfg.modelKey}:${day}`, cfg.modelDailyRequestCap, "model");
  if (cfg.userId) push(`user:${cfg.providerId}:${cfg.userId}:${day}`, cfg.perUserDailyCap, "user");

  if (checks.length) {
    try {
      const counts = await prisma.$transaction(async (tx) => {
        const out: number[] = [];
        for (const c of checks) {
          const row = await tx.llmUsageCounter.upsert({ where: { key: c.key }, create: { key: c.key, count: 1 }, update: { count: { increment: 1 } } });
          if (row.count > c.cap) throw new LlmLimitError(name, c.scope); // rolls back every increment above
          out.push(row.count);
        }
        return out;
      });
      checks.forEach((c, i) => {
        const warnAt = Math.floor((c.raw * soft) / 100);
        if (warnAt > 0 && counts[i] >= warnAt && !warned.has(c.key)) { warned.add(c.key); onSoftWarning?.(c.key, counts[i], c.raw); }
      });
    } catch (e) {
      release();
      throw e;
    }
  }
  return release;
}

/** Today's count for a counter key (admin display). */
export async function counterValue(key: string): Promise<number> {
  return (await prisma.llmUsageCounter.findUnique({ where: { key } }).catch(() => null))?.count ?? 0;
}

/** Test hook. */
export function resetLimitState() { active.clear(); warned.clear(); }
