export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { prisma } from "@/lib/db/prisma";
import { checkHealth, ensureProviders, refreshSnapshot, syncModels, withLease } from "@/lib/ai/llmProviders/registry";

const SYNC_EVERY_MS = 6 * 60 * 60_000;
const USAGE_EVERY_MS = 10 * 60_000;
const HEALTH_EVERY_MS = 10 * 60_000;
const COUNTER_RETENTION_MS = 3 * 86_400_000;

/**
 * Periodic upkeep for dynamic LLM providers. Meant to be called every 5–10
 * minutes by the server's crontab (same pattern and CRON_SECRET as the other
 * /api/cron routes); each task runs only when it is due:
 *  - model sync every 6 hours (also for disabled providers: /models is free),
 *  - provider-reported limits/usage every 10 minutes (enabled providers),
 *  - a lightweight health check every 10 minutes (enabled providers).
 * A lease stops overlapping runs; the result lists only statuses and safe codes.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const run = await withLease("cron", 9 * 60_000, async () => {
    await ensureProviders();
    const providers = await prisma.llmProvider.findMany();
    const now = Date.now();
    const report: Record<string, Record<string, unknown>> = {};
    for (const p of providers) {
      const r: Record<string, unknown> = {};
      if (!p.lastSyncAt || now - p.lastSyncAt.getTime() >= SYNC_EVERY_MS) {
        const s = await syncModels(p.id).catch(() => null);
        r.sync = s ? { ok: s.ok, added: s.added, unavailable: s.unavailable, error: s.error } : { ok: false };
      }
      if (p.enabled) {
        if (!p.lastHealthAt || now - p.lastHealthAt.getTime() >= HEALTH_EVERY_MS) {
          const h = await checkHealth(p.id).catch(() => null);
          r.health = h ? { status: h.status, error: h.error } : { status: "UNKNOWN" };
        }
        const s = await refreshSnapshot(p.id, USAGE_EVERY_MS).catch(() => null);
        r.usage = s ? { status: s.status, fetchedAt: s.fetchedAt } : null;
      }
      report[p.id] = r;
    }
    // Day counters older than three days are never read again.
    const cutoff = new Date(now - COUNTER_RETENTION_MS);
    const pruned = await prisma.llmUsageCounter.deleteMany({ where: { updatedAt: { lt: cutoff } } }).catch(() => ({ count: 0 }));
    return { report, prunedCounters: pruned.count };
  });
  if (!run) return NextResponse.json({ skipped: true, reason: "ALREADY_RUNNING" });
  return NextResponse.json(run);
}
