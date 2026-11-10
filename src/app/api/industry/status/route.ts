export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** What an industry page offers this visitor: sign up, buy CRM, activate, or open the workspace. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ signedIn: false, currentPackSlug: null, hasBusinessSubscription: false });
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { crmPlan: true, crmPlanExpiry: true, industryPack: { select: { slug: true } } } });
  return NextResponse.json({
    signedIn: true,
    currentPackSlug: u?.industryPack?.slug ?? null,
    hasBusinessSubscription: !!u && u.crmPlan !== "NONE" && (!u.crmPlanExpiry || u.crmPlanExpiry.getTime() > Date.now()),
  });
}
