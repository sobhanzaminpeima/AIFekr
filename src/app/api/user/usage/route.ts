export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const since = new Date(Date.now() - 30 * 24 * 3_600_000);

  const rows = await (prisma as any).$queryRaw`
    SELECT type, COUNT(*) as count, SUM(credits) as totalCredits
    FROM UsageLog
    WHERE userId = ${user.id} AND createdAt >= ${since.toISOString()}
    GROUP BY type
    ORDER BY totalCredits DESC
  `;

  const byType = (rows as any[]).map((r) => ({
    type: r.type,
    count: typeof r.count === "bigint" ? Number(r.count) : r.count,
    totalCredits: typeof r.totalCredits === "bigint" ? Number(r.totalCredits) : r.totalCredits,
  }));

  const totalCredits = byType.reduce((sum, r) => sum + r.totalCredits, 0);

  return NextResponse.json({ byType, totalCredits, days: 30, creditsRemaining: user.credits });
}
