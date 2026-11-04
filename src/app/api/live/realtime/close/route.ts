export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { LiveError } from "@/lib/live/service";
import { closeRealtime } from "@/lib/live/realtime";

/** Ends the caller's live call: `{ sessionId }` (also sent with navigator.sendBeacon when the page closes). */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const body = JSON.parse(await req.text().catch(() => "") || "null") as { sessionId?: unknown } | null;
  try {
    return NextResponse.json(await closeRealtime(user.id, String(body?.sessionId ?? "")));
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
