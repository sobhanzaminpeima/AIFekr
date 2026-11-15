export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SettingsError, providerView, requireLlmAdmin, saveSettings, settingsSchema } from "@/lib/ai/llmProviders/admin";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH: provider settings (enabled, base URL, timeout, default model, credit
 * cost, caps, fallback). `apiKey` is write-only and encrypted at rest; only a
 * SUPER_ADMIN may set or clear it. Every change is audited (the key only as
 * "replaced"/"cleared").
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireLlmAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const body = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_SETTINGS", fields: body.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  try {
    const changed = await saveSettings(admin, id, body.data);
    const row = await prisma.llmProvider.findUnique({ where: { id }, include: { models: { orderBy: [{ available: "desc" }, { priority: "asc" }, { externalId: "asc" }] } } });
    return NextResponse.json({ ok: true, changed, provider: row ? await providerView(row) : null });
  } catch (e) {
    if (e instanceof SettingsError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
