export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { audit, requireLlmAdmin } from "@/lib/ai/llmProviders/admin";
import { checkHealth } from "@/lib/ai/llmProviders/registry";
import { LlmProviderError } from "@/lib/ai/llmProviders/errors";
import { rateLimit } from "@/lib/utils/rateLimit";

type Params = { params: Promise<{ id: string }> };

/**
 * POST: Test Connection. Uses the provider's read-only limits endpoint (free;
 * no model is called), stores the health status and returns only the status,
 * latency and a safe error code.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const limit = rateLimit(`llm-test:${admin.id}`, 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  try {
    const result = await checkHealth(id);
    await audit(admin, "llm.provider_tested", id, { status: result.status, error: result.error });
    return NextResponse.json({ ok: result.status === "HEALTHY", ...result });
  } catch (e) {
    if (e instanceof LlmProviderError) return NextResponse.json({ ok: false, status: "OFFLINE", error: e.category }, { status: 404 });
    throw e;
  }
}
