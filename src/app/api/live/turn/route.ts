export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/utils/rateLimit";
import { getServerLang } from "@/lib/i18n/server";
import { liveTurn, LiveError, type LiveHistory } from "@/lib/live/service";
import { logError } from "@/lib/logging/errorLog";

/** One AIFekr Live turn: multipart with `audio` (recorded speech) or `text`, plus `voiceId` and `history` (JSON). */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!rateLimit(`live:${user.id}`, 20, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }); }
  let history: LiveHistory = [];
  try { const raw = JSON.parse(String(form.get("history") || "[]")); if (Array.isArray(raw)) history = raw; } catch { /* treat as a new conversation */ }
  const audio = form.get("audio");
  try {
    const result = await liveTurn({
      userId: user.id, lang: await getServerLang(), voiceId: String(form.get("voiceId") || ""), history,
      audio: audio instanceof File ? audio : null, text: typeof form.get("text") === "string" ? String(form.get("text")) : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.code, ...e.extra }, { status: e.status });
    await logError({ source: "/api/live/turn", error: e, userId: user.id });
    return NextResponse.json({ error: "LIVE_FAILED" }, { status: 500 });
  }
}
