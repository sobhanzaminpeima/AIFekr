export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { audit, requireLlmAdmin } from "@/lib/ai/llmProviders/admin";
import { syncModels } from "@/lib/ai/llmProviders/registry";
import { rateLimit } from "@/lib/utils/rateLimit";

type Params = { params: Promise<{ id: string }> };

/** POST: Sync Models now (idempotent; models the provider dropped become unavailable, never deleted). */
export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!(await prisma.llmProvider.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
  const limit = rateLimit(`llm-sync:${admin.id}`, 6, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const result = await syncModels(id);
  await audit(admin, "llm.models_synced", id, result as unknown as Record<string, unknown>);
  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
