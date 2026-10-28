import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseTouch } from "@/lib/growth/attribution";
import { recordTouch, trackEvent } from "@/lib/growth/events";
import { anonIdFor, sessionUserId, setAnonCookie } from "@/lib/growth/request";
import { growthFlag } from "@/lib/growth/config";

const body = z.object({ url: z.string().max(2000), referrer: z.string().max(2000).optional().nullable() });
const OWN_HOSTS = ["aifekr.com", "aifekr.ir", "localhost", "127.0.0.1"];

/** Landing beacon: stores a campaign/referrer touch for the visitor (no IP, no full referrer). */
export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { anonId, fresh } = anonIdFor(req);
  const res = NextResponse.json({ ok: true });
  if (!(await growthFlag("customer_event_tracking_enabled"))) return res;
  if (fresh) setAnonCookie(res, anonId);
  const result = parseTouch(parsed.data.url, parsed.data.referrer, OWN_HOSTS);
  if (result) {
    const userId = sessionUserId(req);
    const touchId = await recordTouch(anonId, result.touch, userId).catch(e => { console.error("[growth] touch failed:", e); return null; });
    if (touchId) await trackEvent({ name: "landing_viewed", anonId, userId, moduleId: result.touch.targetModule, source: "client", metadata: { touchId, campaign: result.touch.utmCampaign ?? null } });
  }
  return res;
}
