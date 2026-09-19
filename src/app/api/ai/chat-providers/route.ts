export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getAvailableProviders } from "@/lib/ai/providers";
import { prisma } from "@/lib/db/prisma";
import { getDisabledProviders, refreshDisabledProviders } from "@/lib/ai/providerConfig";

// User-facing list of usable chat/text models, for model pickers in content
// generation flows (business posts, Instagram captions, etc). `model` is
// what callers must pass back as the `model` field — it's matched against
// Provider.model in src/lib/ai/router.ts's selectProvider(), same as the
// existing "auto" chat model picker convention.
import { getCreditCosts } from "@/lib/utils/creditCosts";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  await refreshDisabledProviders();
  const disabled = getDisabledProviders();
  const providers = getAvailableProviders()
    .filter((p) => !disabled.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, model: p.model, creditCost: p.creditCost }));

  // Admin-added custom providers (see /admin/llm → "افزودن API سفارشی").
  // `model` is prefixed "custom:<id>" so callers can tell them apart from
  // the static PROVIDERS list without a name/model string collision.
  const custom = await prisma.customAiProvider.findMany({ where: { enabled: true, type: "chat" } });
  const defaultChatCost = (await getCreditCosts()).chat;
  const customEntries = custom.map((p) => ({ id: `custom:${p.id}`, name: p.name, model: `custom:${p.id}`, creditCost: defaultChatCost }));

  return NextResponse.json({ providers: [...providers, ...customEntries] });
}
