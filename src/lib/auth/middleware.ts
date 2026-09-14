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
      // User's preferred display currency (see prisma schema for details) --
      // on the shared auth user object so any route can read it without a
      // separate query, the same way plan/credits already work.
      currency: true,
    },
  });

  if (!user || user.isBlocked) return null;

  // A lapsed paid plan must fall back to FREE-tier limits everywhere plan
  // gates read user.plan (image/video/music generation, CRM contact caps,
  // social auto-publish, etc.) — planExpiry was being stored but never
  // enforced, so every non-team paid plan kept full access forever after
  // the subscription lapsed. Downgrading here (the single shared auth
  // entry point) closes that gap for every caller at once, mirroring the
  // expiry check hasVoiceAccess already does for the Voice add-on.
  if (user.plan !== "FREE" && user.planExpiry && user.planExpiry.getTime() < Date.now()) {
    user.plan = "FREE";
  }

  return user;
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
