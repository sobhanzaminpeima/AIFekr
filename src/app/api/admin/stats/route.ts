export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const [
      totalUsers,
      todayUsers,
      activeSubscriptions,
      todayRevenue,
      yesterdayRevenue,
      todayRequests,
      yesterdayRequests,
      planDistribution,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { gte: now } } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.usageLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.usageLog.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.user.groupBy({ by: ["plan"], _count: true }),
      prisma.usageLog.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } }),
    ]);

    // Revenue last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const revenueData = await prisma.payment.findMany({
      where: { status: "SUCCESS", createdAt: { gte: thirtyDaysAgo } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group revenue by day
    const revenueByDay: Record<string, number> = {};
    revenueData.forEach(({ amount, createdAt }) => {
      const day = createdAt.toISOString().split("T")[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + amount;
    });

    const todayRev = todayRevenue._sum.amount || 0;
    const yesterdayRev = yesterdayRevenue._sum.amount || 0;
    const revenueChange = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : 0;
    const requestsChange = yesterdayRequests > 0 ? ((todayRequests - yesterdayRequests) / yesterdayRequests) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalUsers,
        todayUsers,
        activeSubscriptions,
        todayRevenue: todayRev,
        revenueChange: revenueChange.toFixed(1),
        todayRequests,
        requestsChange: requestsChange.toFixed(1),
      },
      planDistribution: planDistribution.map((p) => ({ plan: p.plan, count: p._count })),
      revenueByDay,
      recentActivity,
    });
  } catch (err) {
    console.error("admin stats error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
