export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { LiveError } from "@/lib/live/service";
import { MAX_AUDIO_CHUNK, pushAudio } from "@/lib/live/realtime";

/** One microphone chunk of a live call: `?id=<sessionId>`, body raw 24 kHz mono 16-bit PCM. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const body = new Uint8Array(await req.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (body.length > MAX_AUDIO_CHUNK) return NextResponse.json({ error: "INVALID_AUDIO" }, { status: 413 });
  try {
    pushAudio(user.id, req.nextUrl.searchParams.get("id") || "", body);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
