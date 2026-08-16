export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import * as qwen from "@/lib/ai/qwen";
import * as openaiImage from "@/lib/ai/openaiImage";
import { prisma } from "@/lib/db/prisma";

// User-facing (not admin-only) list of which image models are actually
// usable right now, for model-picker dropdowns in the image tool, the
// Instagram post wizard, and business content creation. Mirrors the same
// "hasX" checks each lib/ai/*.ts provider already does internally — no env
// values are exposed here, just id/name/configured.
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const providers = [
    { id: "openai", name: "OpenAI (gpt-image)", configured: openaiImage.isOpenAIImageAvailable },
    { id: "qwen", name: "Qwen Image", configured: qwen.isQwenImageAvailable },
  ].filter((p) => p.configured);

  // Admin-added custom providers of type "image" (see /admin/llm) — same
  // "custom:<id>" convention as chat-providers so callers can route to them.
  const custom = await prisma.customAiProvider.findMany({ where: { enabled: true, type: "image" } });
  const customEntries = custom.map((p) => ({ id: `custom:${p.id}`, name: p.name, configured: true }));

  return NextResponse.json({ providers: [...providers, ...customEntries] });
}
