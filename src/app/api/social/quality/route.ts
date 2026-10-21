export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { scoreContent, qualityMessage } from "@/lib/social/contentQuality";
import { getServerLang } from "@/lib/i18n/server";

/**
 * Re-scores a caption as the owner edits it in the wizard. Pure computation —
 * no AI call, no external request — so it is safe to call on every keystroke
 * (debounced client-side).
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.caption !== "string") {
    return NextResponse.json({ error: "caption الزامی است" }, { status: 400 });
  }

  const lang = await getServerLang();
  const result = scoreContent({
    caption: body.caption,
    hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((h: unknown) => typeof h === "string") : [],
    format: typeof body.format === "string" ? body.format : null,
  });

  return NextResponse.json({
    score: result.score,
    band: result.band,
    findings: result.findings.map((f) => ({ code: f.code, message: qualityMessage(f, lang) })),
  });
}
