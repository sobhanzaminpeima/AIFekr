export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getAvailableProviders } from "@/lib/ai/providers";
import { prisma } from "@/lib/db/prisma";
import fs from "fs";
import path from "path";

function getDisabledProviders(): Set<string> {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/lib/ai/provider-config.json"), "utf-8"));
    return new Set(cfg.disabled ?? []);
  } catch {
    return new Set();
  }
}

// User-facing list of usable chat/text models, for model pickers in content
// generation flows (business posts, Instagram captions, etc). `model` is
// what callers must pass back as the `model` field — it's matched against
// Provider.model in src/lib/ai/router.ts's selectProvider(), same as the
// existing "auto" chat model picker convention.
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const disabled = getDisabledProviders();
  const providers = getAvailableProviders()
    .filter((p) => !disabled.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, model: p.model }));

  // Admin-added custom providers (see /admin/llm → "افزودن API سفارشی").
  // `model` is prefixed "custom:<id>" so callers can tell them apart from
  // the static PROVIDERS list without a name/model string collision.
  const custom = await prisma.customAiProvider.findMany({ where: { enabled: true } });
  const customEntries = custom.map((p) => ({ id: `custom:${p.id}`, name: p.name, model: `custom:${p.id}` }));

  return NextResponse.json({ providers: [...providers, ...customEntries] });
}
