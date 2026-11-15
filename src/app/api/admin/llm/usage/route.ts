export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SettingsError, requireLlmAdmin, usageDashboard, usageQuerySchema } from "@/lib/ai/llmProviders/admin";
import { refreshSnapshot } from "@/lib/ai/llmProviders/registry";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * GET: Usage & Credits for every provider: what AIFekr tracked itself
 * (Locally tracked, from the unified ledger) next to what each dynamic
 * provider reported (Provider reported, from the latest snapshot), with
 * estimated costs kept apart. Filters: range (today | 7d | 30d | custom with
 * from/to), providerId, modelId, userId, status.
 *
 * POST: refresh provider-reported figures now. Snapshots younger than 30 s
 * are reused, so repeated clicks do not multiply upstream calls.
 */
export async function GET(req: NextRequest) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const q = usageQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: "INVALID_FILTER", fields: q.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  try {
    return NextResponse.json(await usageDashboard(q.data), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SettingsError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const limit = rateLimit(`llm-usage-refresh:${admin.id}`, 6, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const providers = await prisma.llmProvider.findMany({ where: { enabled: true }, select: { id: true } });
  const results = await Promise.all(providers.map(async (p) => {
    const s = await refreshSnapshot(p.id, 30_000);
    return { providerId: p.id, status: s?.status ?? null, error: s?.error ?? null, fetchedAt: s?.fetchedAt ?? null };
  }));
  return NextResponse.json({ ok: true, results });
}
