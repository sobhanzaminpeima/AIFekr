export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { listProviderViews, requireLlmAdmin } from "@/lib/ai/llmProviders/admin";

/**
 * GET: dynamic LLM providers (Coarena) for Admin → LLM Management, with their
 * models, today's locally tracked usage per model and the latest
 * provider-reported snapshot. Keys appear only masked.
 */
export async function GET(req: NextRequest) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ providers: await listProviderViews() }, { headers: { "Cache-Control": "no-store" } });
}
