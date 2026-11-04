export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { LiveError } from "@/lib/live/service";
import { hasRelay, subscribe, type RelayEvent } from "@/lib/live/realtime";

/** The live call's server-sent events: the assistant's audio (24 kHz PCM, base64), both transcripts, and the end of the call. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!hasRelay(user.id, id)) return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  try {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (e: RelayEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
            if (e.type === "closed") { clearInterval(ping); controller.close(); }
          } catch { /* stream already closed */ }
        };
        unsubscribe = subscribe(user.id, id, write);
        // Keeps proxies from closing a quiet stream while the user is thinking.
        ping = setInterval(() => { try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { clearInterval(ping); } }, 15000);
        req.signal.addEventListener("abort", () => { clearInterval(ping); unsubscribe(); });
      },
      cancel() { clearInterval(ping); unsubscribe(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" } });
  } catch (e) {
    clearInterval(ping);
    if (e instanceof LiveError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
