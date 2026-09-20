export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** Audit history of a site (newest first) -- enough to draw the score trend. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const audits = await prisma.seoAudit.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, score: true, pagesCrawled: true, failCount: true, warnCount: true, passCount: true, source: true, createdAt: true, planCreatedAt: true },
  });
  return NextResponse.json({ site, audits });
}
