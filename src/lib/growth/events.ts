import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { growthFlag } from "./config";
import type { Confidence, TouchInput } from "./attribution";
import { moduleForPath } from "./attribution";

/**
 * Names a browser may report. Everything about money, credits or AI success
 * is recorded server-side (or read from Payment/UsageLog), so a forged client
 * call can never create a purchase, a checkout or a "first value".
 */
export const CLIENT_EVENTS = new Set([
  "landing_viewed", "signup_started", "pricing_page_viewed", "plan_selected", "module_viewed",
  "onboarding_started", "onboarding_step_completed", "onboarding_skipped",
  "voice_played", "voice_project_reopened", "feature_search_used", "workspace_switched", "upgrade_prompt_viewed", "upgrade_prompt_clicked", "demo_requested",
]);

export type TrackInput = {
  name: string;
  userId?: string | null;
  anonId?: string | null;
  moduleId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  idempotencyKey?: string;
  source?: "server" | "client";
};

/** Keeps metadata small and flat: short keys, primitive values, no long strings (no prompts or content). */
export function sanitizeMetadata(meta: TrackInput["metadata"]): string {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta || {}).slice(0, 12)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean" || v === null) out[k] = v;
  }
  return JSON.stringify(out);
}

/**
 * Records one event. Never throws into the caller: tracking must not break
 * a generation, a payment or a sign-up. A repeated idempotency key is a no-op.
 */
export async function trackEvent(input: TrackInput, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  try {
    if (!(await growthFlag("customer_event_tracking_enabled"))) return false;
    if (!/^[a-z0-9_]{2,60}$/.test(input.name) || (!input.userId && !input.anonId)) return false;
    await db.growthEvent.create({ data: {
      name: input.name, userId: input.userId || null, anonId: input.anonId || null, moduleId: input.moduleId?.slice(0, 40) || null,
      metadata: sanitizeMetadata(input.metadata), source: input.source || "server", idempotencyKey: input.idempotencyKey?.slice(0, 160) || null,
    } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    console.error("[growth] trackEvent failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Stores a landing touch, linked to an admin campaign by utm_campaign. Repeats within 30 minutes are ignored. */
export async function recordTouch(anonId: string, touch: TouchInput, userId?: string | null) {
  const recent = await prisma.growthTouch.findFirst({ where: { anonId, createdAt: { gte: new Date(Date.now() - 30 * 60_000) }, utmCampaign: touch.utmCampaign ?? null, referrerHost: touch.referrerHost ?? null }, select: { id: true } });
  if (recent) return recent.id;
  const campaign = touch.utmCampaign ? await prisma.growthCampaign.findUnique({ where: { utmCampaign: touch.utmCampaign }, select: { id: true, targetModule: true } }) : null;
  const row = await prisma.growthTouch.create({ data: { anonId, userId: userId || null, campaignId: campaign?.id ?? null, ...touch, targetModule: touch.targetModule ?? campaign?.targetModule ?? null } });
  if (userId) await prisma.growthProfile.upsert({ where: { userId }, create: { userId, firstTouchId: row.id, lastTouchId: row.id, attributionConfidence: touch.utmSource || touch.utmCampaign ? "utm" : "referrer" }, update: { lastTouchId: row.id } });
  return row.id;
}

/**
 * Called once at account creation (password, OTP or Google). Links the
 * visitor's anonymous touches and events to the new user and records
 * first/last touch. Without a touch the source stays "unknown" -- never guessed.
 */
export async function linkSignup(userId: string, anonId: string | null | undefined, intendedPath?: string | null) {
  try {
    if (anonId && /^[a-zA-Z0-9_-]{16,64}$/.test(anonId)) {
      await prisma.growthTouch.updateMany({ where: { anonId, userId: null }, data: { userId } });
      await prisma.growthEvent.updateMany({ where: { anonId, userId: null }, data: { userId } });
    }
    const touches = anonId ? await prisma.growthTouch.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, utmSource: true, utmCampaign: true, targetModule: true } }) : [];
    const first = touches[0], last = touches[touches.length - 1];
    const confidence: Confidence = first ? (first.utmSource || first.utmCampaign ? "utm" : "referrer") : anonId ? "direct" : "unknown";
    const intendedModule = (intendedPath ? moduleForPath(intendedPath.split("?")[0]) : null) ?? last?.targetModule ?? null;
    await prisma.growthProfile.upsert({
      where: { userId },
      create: { userId, firstTouchId: first?.id, lastTouchId: last?.id, attributionConfidence: confidence, intendedModule, onboardingState: intendedModule ? "contextual" : "not_started" },
      update: { firstTouchId: first?.id, lastTouchId: last?.id, attributionConfidence: confidence, intendedModule },
    });
    await trackEvent({ name: "user_signed_up", userId, moduleId: intendedModule, idempotencyKey: `signup:${userId}`, metadata: { campaign: first?.utmCampaign ?? null } });
    return { intendedModule };
  } catch (e) {
    console.error("[growth] linkSignup failed:", e instanceof Error ? e.message : e);
    return { intendedModule: null };
  }
}
