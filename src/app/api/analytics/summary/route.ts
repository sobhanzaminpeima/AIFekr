import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN"))
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

  // Feature usage breakdown
  const featureCounts = await prisma.usageLog.groupBy({
    by: ["type"],
    _count: { type: true },
    where: { createdAt: { gte: since } },
    orderBy: { _count: { type: "desc" } },
  });

  // Daily active users (last 14 days)
  const dauRows = await prisma.usageLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
    select: { userId: true, createdAt: true },
  });

  const dauByDay: Record<string, Set<string>> = {};
  for (const r of dauRows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    if (!dauByDay[day]) dauByDay[day] = new Set();
    dauByDay[day].add(r.userId);
  }
  const dau = Object.entries(dauByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, users]) => ({ date, count: users.size }));

  // New users last 30 days
  const newUsers = await prisma.user.groupBy({
    by: ["createdAt"],
    _count: { id: true },
    where: { createdAt: { gte: since } },
  });

  // Retention: users who used platform in week 1 AND week 2 after signup
  const totalUsers = await prisma.user.count();
  const activeLastWeek = await prisma.usageLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { userId: true },
    distinct: ["userId"],
  });

  // Shares generated
  const sharesAnalysis = await prisma.businessAnalysis.count({ where: { shareToken: { not: null } } });
  const sharesPipeline = await prisma.contentPipelineRun.count({ where: { shareToken: { not: null } } });

  // Top features (all-time)
  const topFeaturesAllTime = await prisma.usageLog.groupBy({
    by: ["type"],
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  return NextResponse.json({
    featureCounts,
    dau,
    totalUsers,
    activeLastWeek: activeLastWeek.length,
    sharesTotal: sharesAnalysis + sharesPipeline,
    topFeaturesAllTime,
    newUsersCount: newUsers.length,
  });
}
