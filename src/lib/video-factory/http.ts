import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { isFeatureEnabled } from "@/lib/utils/featureToggles";
import { rateLimit } from "@/lib/utils/rateLimit";
import { FactoryError } from "./domain";

export async function factoryRoute(req: NextRequest, admin: boolean, handler: (userId: string) => Promise<NextResponse>) {
  const user = await (admin ? requireAdmin(req) : requireAuth(req));
  if (!user) return unauthorizedResponse(req);
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    // Next dev can canonicalize the internal URL to localhost while a browser
    // reaches 127.0.0.1. Compare the actual Host as well, without trusting a
    // caller-supplied forwarded host or accepting a cross-site origin.
    const host=req.headers.get("host");
    const requestOrigin=host && /^[a-zA-Z0-9.:[\]-]+$/.test(host)?`${req.nextUrl.protocol}//${host}`:req.nextUrl.origin;
    if (origin && origin !== req.nextUrl.origin && origin!==requestOrigin) return NextResponse.json({ code: "ORIGIN_FORBIDDEN" }, { status: 403 });
    if (!rateLimit(`video-factory:${user.id}`, 30, 60000).allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }
  if (!admin && (user.trialLimited || !await isFeatureEnabled("video"))) return NextResponse.json({ code: "VIDEO_ACCESS_DISABLED" }, { status: 403 });
  try { return await handler(user.id); }
  catch (error) {
    const code = error instanceof FactoryError ? error.code : error instanceof ZodError || error instanceof SyntaxError ? "INVALID_INPUT" : "VIDEO_FACTORY_UNAVAILABLE";
    return NextResponse.json({ code }, { status: error instanceof FactoryError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 503 });
  }
}
export async function boundedJson(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new FactoryError("INVALID_INPUT", 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 2_000_000) { await reader.cancel(); throw new FactoryError("INPUT_TOO_LARGE", 413); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
