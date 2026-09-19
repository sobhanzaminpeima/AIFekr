export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { channelReport } from "@/lib/leadgen/repository";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const [channels, totalLeads, formLeads, avgScoreAgg] = await Promise.all([
    channelReport(user.id, businessId),
    prisma.crmContact.count({ where: { userId: user.id, ...bizScope(businessId), status: "lead" } }),
    prisma.crmContact.count({ where: { userId: user.id, ...bizScope(businessId), source: "lead_form" } }),
    prisma.leadFormSubmission.aggregate({
      where: { form: { userId: user.id, ...bizScope(businessId) } },
      _avg: { score: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    channels,
    totalLeads,
    formLeads,
    formSubmissions: avgScoreAgg._count._all,
    avgScore: Math.round(avgScoreAgg._avg.score ?? 0),
  });
}
