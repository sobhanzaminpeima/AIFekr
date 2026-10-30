import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { trackEvent } from "./events";

/**
 * Activation measurement for AI generation. Only the server records these, from
 * the real outcome (the route's own response, a saved answer, a finished job),
 * so a page view or a click never counts as success, and a failed generation
 * can be told apart from a user who simply left. No prompt or output text is
 * stored. Tracking never changes a response and never throws into a route.
 */

/** Accounts created from this moment are measured for their first success; older ones started before measurement existed. */
export const FIRST_SUCCESS_SINCE = new Date("2026-10-30T00:00:00Z");

export type FailureReason = "credits" | "plan" | "limit" | "rate_limited" | "disabled" | "invalid_input" | "forbidden" | "provider" | "cancelled";

const CODE_REASONS: Record<string, FailureReason> = {
  PLAN_REQUIRED: "plan", REQUIRES_UPGRADE: "plan", VIDEO_PACKAGE_REQUIRED_OR_EXHAUSTED: "plan",
  INSUFFICIENT_CREDITS: "credits", CREDITS_INSUFFICIENT: "credits",
  RATE_LIMIT: "rate_limited", RATE_LIMITED: "rate_limited",
  FEATURE_DISABLED: "disabled", FACTORY_DISABLED: "disabled", VOICE_STUDIO_DISABLED: "disabled",
  CANCELLED: "cancelled",
};

/** What a non-successful generation response means, from its status and its error code or wording. */
export function classifyFailure(status: number, body: Record<string, unknown> | null): FailureReason | null {
  if (status < 400 || status === 401) return null;
  const code = typeof body?.code === "string" ? body.code : typeof body?.error === "string" && /^[A-Z_]{4,}$/.test(body.error) ? body.error : "";
  if (code && CODE_REASONS[code]) return CODE_REASONS[code];
  const text = typeof body?.error === "string" ? body.error : "";
  if (body?.requiresUpgrade === true) return "plan";
  if (status === 402) {
    if (/سقف|limit|Limit/.test(text)) return "limit";
    if (/پلن|plan|Plan|ارتقا|upgrade/.test(text)) return "plan";
    return "credits";
  }
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 503) return "disabled";
  if (status === 400 || status === 413 || status === 422) return "invalid_input";
  return "provider";
}

/** A generation attempt the user started. */
export function recordGenerationStarted(userId: string, moduleId: string) {
  return trackEvent({ name: "generation_started", userId, moduleId });
}

/** A confirmed result (saved image, finished video, saved answer...). `ref` identifies it, so repeated polls record it once. */
export async function recordGenerationSucceeded(userId: string, moduleId: string, ref: string) {
  await trackEvent({ name: "generation_succeeded", userId, moduleId, idempotencyKey: `gen_ok:${moduleId}:${ref}` });
  await recordFirstSuccess(userId, moduleId);
}

/** A generation that did not produce a result, and why. Credit and plan refusals are also recorded under their own names. */
export async function recordGenerationFailed(userId: string, moduleId: string, reason: FailureReason, ref?: string) {
  await trackEvent({ name: "generation_failed", userId, moduleId, metadata: { reason }, ...(ref ? { idempotencyKey: `gen_fail:${moduleId}:${ref}` } : {}) });
  if (reason === "credits") await trackEvent({ name: "credits_insufficient", userId, moduleId });
  if (reason === "plan" || reason === "limit") await trackEvent({ name: "plan_required", userId, moduleId, metadata: { reason } });
}

/** The account's first confirmed result, once ever, for accounts measured from the start. */
export async function recordFirstSuccess(userId: string, moduleId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user || user.createdAt < FIRST_SUCCESS_SINCE) return;
    await trackEvent({ name: "first_success_achieved", userId, moduleId, metadata: { minutesFromSignup: Math.round((Date.now() - user.createdAt.getTime()) / 60000) }, idempotencyKey: `first_success:${userId}` });
  } catch { /* measurement only */ }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/**
 * Measures a synchronous-or-queued generation route from its own response:
 * started on every signed-in call, succeeded when the route returns a saved
 * result (`succeeded` names where its id is), failed with the classified
 * reason otherwise. A queued job (a prediction) only counts as started here;
 * its status route records the outcome.
 */
export function withGenerationTracking<C>(moduleId: string, handler: Handler<C>, succeeded: (body: Record<string, unknown>) => string | null): (req: NextRequest, ctx?: C) => Promise<Response> {
  return async (req, ctx) => {
    const token = req.cookies.get("token")?.value;
    const userId = token ? verifyToken(token)?.userId ?? null : null;
    if (userId) void recordGenerationStarted(userId, moduleId);
    const res = await handler(req, ctx as C);
    if (!userId || (res.headers.get("content-type") || "").includes("event-stream")) return res;
    void (async () => {
      try {
        const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
        if (res.ok) {
          const ref = body ? succeeded(body) : null;
          if (ref) await recordGenerationSucceeded(userId, moduleId, ref);
          return;
        }
        const reason = classifyFailure(res.status, body);
        if (reason) await recordGenerationFailed(userId, moduleId, reason);
      } catch { /* measurement only */ }
    })();
    return res;
  };
}
