export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getAvailableCredits } from "@/lib/utils/teamCredits";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const since = new Date(Date.now() - 30 * 24 * 3_600_000);

  const rows = await prisma.usageLog.groupBy({ by: ["type"], where: { userId: user.id, createdAt: { gte: since } }, _count: { _all: true }, _sum: { credits: true }, orderBy: { _sum: { credits: "desc" } } });
  const byType = rows.map((row) => ({ type: row.type, count: row._count._all, totalCredits: row._sum.credits || 0 }));

  const totalCredits = byType.reduce((sum, r) => sum + r.totalCredits, 0);
  const creditsRemaining = await getAvailableCredits(user.id);

  return NextResponse.json({ byType, totalCredits, days: 30, creditsRemaining });
}
