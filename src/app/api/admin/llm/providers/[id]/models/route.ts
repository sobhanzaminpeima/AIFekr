export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SettingsError, modelsPatchSchema, patchModels, requireLlmAdmin } from "@/lib/ai/llmProviders/admin";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH: one or many models at once: enable/disable (bulk), priority, credit
 * cost, daily cap, or make one model the provider default. Unavailable models
 * cannot be enabled. Audited.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const body = modelsPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_REQUEST", fields: body.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  try {
    await patchModels(admin, id, body.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SettingsError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
