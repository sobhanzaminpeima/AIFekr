export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { instagramHealth, searchConsoleHealth, wordpressHealth } from "@/lib/connections/health";

/** E3: the signed-in account's external connections and whether each needs attention. No token or password leaves the server. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const businessId = await activeBusinessIdFor(user.id);
  const [instagram, gsc, seo] = await Promise.all([
    prisma.instagramConnection.findFirst({ where: { userId: user.id, ...instagramWorkspaceScope(businessId) }, select: { igUsername: true, tokenExpiry: true } }),
    prisma.gscConnection.findUnique({ where: { userId: user.id }, select: { siteUrl: true } }),
    prisma.seoConnection.findUnique({ where: { userId: user.id }, select: { platform: true, siteUrl: true, wpUsername: true, wpAppPassword: true } }),
  ]);
  const connections = [
    instagramHealth(instagram),
    searchConsoleHealth(gsc),
    wordpressHealth(seo ? { platform: seo.platform, siteUrl: seo.siteUrl, wpUsername: seo.wpUsername, hasPassword: !!seo.wpAppPassword } : null),
  ];
  return NextResponse.json({ connections, checkedAt: new Date().toISOString() });
}
