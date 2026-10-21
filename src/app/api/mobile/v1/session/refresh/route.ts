import { NextRequest, NextResponse } from "next/server";
import { rotateMobileSession } from "@/lib/auth/mobileSessions";
import { getClientIp, rateLimit } from "@/lib/utils/rateLimit";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.MOBILE_API_ENABLED !== "true") return NextResponse.json({ error: "Mobile access is not enabled" }, { status: 503, headers });
  const limit = rateLimit(`mobile-refresh:${getClientIp(req.headers)}`, 30, 60000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) } });
  const body = await req.json().catch(() => null);
  if (typeof body?.refreshToken !== "string" || body.refreshToken.length > 150) return NextResponse.json({ error: "Invalid session" }, { status: 400, headers });
  try {
    const session = await rotateMobileSession(body.refreshToken);
    return session ? NextResponse.json(session, { headers }) : NextResponse.json({ error: "Session expired or revoked" }, { status: 401, headers });
  } catch { return NextResponse.json({ error: "Mobile session service unavailable" }, { status: 503, headers }); }
}
