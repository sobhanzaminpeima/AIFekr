import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";
import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      plan: true,
      credits: true,
      planExpiry: true,
      isBlocked: true,
      crmPlan: true,
      crmPlanExpiry: true,
      voicePlan: true,
      voicePlanExpiry: true,
      trialLimited: true,
      trialEndsAt: true,
      // User's preferred display currency (see prisma schema for details) --
      // on the shared auth user object so any route can read it without a
      // separate query, the same way plan/credits already work.
      currency: true,
    },
  });

  if (!user || user.isBlocked) return null;

  // Phase 3 of the monetization overhaul: a real active/trialing/past_due/
  // cancelled/paused subscription state machine (as in the master prompt)
  // needs a recurring-billing engine that actually fires renewal-failure
  // events -- neither Zarinpal nor NOWPayments do that here (both are
  // one-off checkout flows, not tokenized auto-renewal), so states like
  // "past_due" or "paused" would have no real trigger and would just be
  // dead code. What's real and worth having: a short grace window after
  // expiry, so a payment that clears a day or two late doesn't instantly
  // and silently cut the user over to FREE mid-session. `subscriptionStatus`
  // is computed here (not persisted) for callers that want to show a
  // renewal-due banner during the grace window.
  const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
  let subscriptionStatus: "active" | "grace_period" | "expired" = "active";
  if (user.plan !== "FREE" && user.planExpiry) {
    const msSinceExpiry = Date.now() - user.planExpiry.getTime();
    if (msSinceExpiry > GRACE_PERIOD_MS) {
      subscriptionStatus = "expired";
      user.plan = "FREE";
    } else if (msSinceExpiry > 0) {
      subscriptionStatus = "grace_period";
    }
  }

  return { ...user, subscriptionStatus };
}

export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return null;
  return user;
}

// `lang` is optional and defaults to Persian so the ~370 existing call sites
// across the API (which mostly can't cheaply await getServerLang() just for
// an error string) keep working unchanged. Callers on a user-facing path
// where the wrong language would actually be seen (e.g. a client-side fetch
// wrapper that shows `error` verbatim) should pass the real lang instead.
export function unauthorizedResponse(lang: Lang = "fa") {
  return NextResponse.json({ error: tri(lang, "احراز هویت الزامی است", "Authentication required", "Authentifizierung erforderlich") }, { status: 401 });
}

export function forbiddenResponse(lang: Lang = "fa") {
  return NextResponse.json({ error: tri(lang, "دسترسی غیرمجاز", "Access denied", "Zugriff verweigert") }, { status: 403 });
}
