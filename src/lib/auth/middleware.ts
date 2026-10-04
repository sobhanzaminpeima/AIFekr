import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";
import { prisma } from "@/lib/db/prisma";
import { featureAccessExpired, isRecoveryApi, teamFeatureExpiry } from "@/lib/subscriptions/access";
const accessDenials=new WeakMap<NextRequest,boolean>();

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
      accountType:true,
      teamMembership:{select:{team:{select:{planExpiry:true,owner:{select:{planExpiry:true}}}}}},
      // User's preferred display currency (see prisma schema for details) --
      // on the shared auth user object so any route can read it without a
      // separate query, the same way plan/credits already work.
      currency: true,
    },
  });

  if (!user || user.isBlocked) return null;

  const expired=featureAccessExpired(user,teamFeatureExpiry(user.teamMembership?.team));
  if(expired&&!isRecoveryApi(req.nextUrl.pathname)){
    accessDenials.set(req,true);return null;
  }
  return { ...user, subscriptionStatus:expired?"expired" as const:"active" as const, featureAccess:!expired };

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
export function unauthorizedResponse(input: Lang | NextRequest = "fa") {
  const cookieLang=typeof input!=="string"?input.cookies.get("lang")?.value:undefined;
  const lang:Lang=typeof input==="string"?input:["fa","en","de","tr"].includes(cookieLang||"")?cookieLang as Lang:"fa";
  if(typeof input!=="string"&&accessDenials.has(input))return NextResponse.json({error:tri(lang,"اشتراک شما منقضی شده است. برای استفاده از امکانات، پکیج را تمدید کنید.","Your subscription has expired. Renew to use platform features.","Ihr Abonnement ist abgelaufen. Bitte verlängern.","Aboneliğiniz sona erdi. Özellikleri kullanmak için yenileyin."),code:"SUBSCRIPTION_EXPIRED",renewUrl:"/pricing"},{status:402});
  return NextResponse.json({ error: tri(lang, "احراز هویت الزامی است", "Authentication required", "Authentifizierung erforderlich") }, { status: 401 });
}

export function forbiddenResponse(lang: Lang = "fa") {
  return NextResponse.json({ error: tri(lang, "دسترسی غیرمجاز", "Access denied", "Zugriff verweigert") }, { status: 403 });
}
