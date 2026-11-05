import type { NextRequest, NextResponse } from "next/server";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { parseTouch } from "./attribution";
import { growthFlag } from "./config";
import { recordTouch, trackEvent } from "./events";
import { anonIdFor, sessionUserId, setAnonCookie } from "./request";

export const OWN_HOSTS = ["aifekr.com", "aifekr.ir", "localhost", "127.0.0.1"];

/** True when the link points at AIFekr itself (not a tenant's own site). */
export function isOwnHost(url: URL): boolean {
  let app: string | null = null;
  try { app = new URL(publicAppUrl()).hostname.replace(/^www\./, ""); } catch { /* none */ }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return [...OWN_HOSTS, ...(app ? [app] : [])].some(h => host === h || host.endsWith("." + h));
}

/**
 * Records the attribution touch for a tracked DM link on the server, before the
 * redirect, and sets the first-party anon cookie on the redirect response.
 * Without this a signed-out visitor sent to an app page (/live) is redirected
 * to sign-in before the page beacon runs, and the UTM is lost. Only links to
 * our own host with UTM values are recorded; it never throws.
 */
export async function recordLinkTouch(req: NextRequest, res: NextResponse, target: URL, referrer = "https://instagram.com/"): Promise<string | null> {
  try {
    if (!isOwnHost(target) || !(await growthFlag("customer_event_tracking_enabled"))) return null;
    const parsed = parseTouch(target.pathname + target.search, referrer, OWN_HOSTS);
    if (!parsed || parsed.confidence !== "utm") return null;
    const { anonId, fresh } = anonIdFor(req);
    if (fresh) setAnonCookie(res, anonId);
    const userId = sessionUserId(req);
    const touchId = await recordTouch(anonId, parsed.touch, userId);
    await trackEvent({ name: "landing_viewed", anonId, userId, moduleId: parsed.touch.targetModule, source: "server", metadata: { touchId, campaign: parsed.touch.utmCampaign ?? null, via: "dm_link" } });
    return touchId;
  } catch (e) {
    console.error("[growth] link touch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
