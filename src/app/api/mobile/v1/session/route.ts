import { NextRequest, NextResponse } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { verifyToken } from "@/lib/auth/jwt";
import { createMobileSession, revokeByRefresh } from "@/lib/auth/mobileSessions";

export const dynamic = "force-dynamic";

/** Native-only bridge. Keep web login and its business rules authoritative. */
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  if (process.env.MOBILE_API_ENABLED !== "true") {
    return NextResponse.json({ error: "Mobile access is not enabled", code: "MOBILE_DISABLED" }, { status: 503, headers });
  }
  const result = await login(req);
  if (!result.ok) {
    return NextResponse.json(await result.json(), {
      status: result.status,
      headers: { ...headers, ...(result.headers.get("Retry-After") ? { "Retry-After": result.headers.get("Retry-After")! } : {}) },
    });
  }
  const browserToken = result.cookies.get("token")?.value;
  const identity = browserToken ? verifyToken(browserToken) : null;
  if (!identity) return NextResponse.json({ error: "Session creation failed" }, { status: 500, headers });
  try {
    const session = await createMobileSession(identity.userId, req.headers.get("x-device-name") || "Mobile device");
    return session ? NextResponse.json(session, { headers }) : NextResponse.json({ error: "Access denied" }, { status: 401, headers });
  } catch { return NextResponse.json({ error: "Mobile session service unavailable" }, { status: 503, headers }); }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.refreshToken !== "string" || body.refreshToken.length > 150) return NextResponse.json({ error: "Invalid session" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await revokeByRefresh(body.refreshToken);
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
