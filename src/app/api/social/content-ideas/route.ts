export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getContentIdeas } from "@/lib/industry";

/** Engaging-format content-idea suggestions for the current user's industry (item 6, batch2). Industry is resolved from the same signal used elsewhere (CrmPipeline.industrySlug) — falls back to the generic pack for any user with no industry-tagged pipeline. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const pipeline = await prisma.crmPipeline.findFirst({
    where: { userId: user.id, industrySlug: { not: null } },
    select: { industrySlug: true },
  });

  return NextResponse.json(getContentIdeas(pipeline?.industrySlug));
}
