export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/utils/rateLimit";
import { getServerLang } from "@/lib/i18n/server";
import { logError } from "@/lib/logging/errorLog";
import { LiveError } from "@/lib/live/service";
import { ensureSweeper, startRealtime } from "@/lib/live/realtime";

/** Starts an AIFekr Live call in live mode; the audio then flows through /audio (up) and /events (down). */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!rateLimit(`live-realtime:${user.id}`, 6, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  ensureSweeper();
  try {
    return NextResponse.json(await startRealtime({ userId: user.id, role: user.role, lang: await getServerLang() }));
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.code, ...e.extra }, { status: e.status });
    await logError({ source: "/api/live/realtime", error: e, userId: user.id });
    return NextResponse.json({ error: "LIVE_REALTIME_FAILED" }, { status: 500 });
  }
}
