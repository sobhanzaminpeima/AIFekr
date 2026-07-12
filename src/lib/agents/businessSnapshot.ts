import { prisma } from "@/lib/db/prisma";

/** Aggregates real, existing data across every AiFekr tool for one user — shared by the on-demand API route and the autonomous cron job. */
export async function buildBusinessSnapshot(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    latestAnalysis, analysisCount,
    latestPosts, postCount,
    latestSocial, socialCount,
    leadsNeedingFollowUp, totalLeads,
    memories,
    revenue30d, usageCount30d, fallbackIssues30d, fallbackBreakdown30d,
  ] = await Promise.all([
    prisma.businessAnalysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.businessAnalysis.count({ where: { userId } }),
    prisma.contentPost.findMany({ where: { userId }, orderBy: { publishedAt: "desc" }, take: 5, select: { title: true, publishedAt: true, externalStatus: true } }),
    prisma.contentPost.count({ where: { userId } }),
    prisma.socialPost.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { platform: true, topic: true, createdAt: true } }),
    prisma.socialPost.count({ where: { userId } }),
    prisma.crmContact.findMany({ where: { userId, status: { in: ["lead", "contacted"] } }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, name: true, phone: true, status: true, lastContact: true, company: true } }),
    prisma.crmContact.count({ where: { userId } }),
    prisma.businessMemory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.payment.aggregate({ where: { userId, status: "SUCCESS", createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.usageLog.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    prisma.providerFallbackLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    prisma.providerFallbackLog.groupBy({
      by: ["fromProvider"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { fromProvider: true },
      orderBy: { _count: { fromProvider: "desc" } },
      take: 5,
    }).catch(() => [] as { fromProvider: string; _count: { fromProvider: number } }[]),
  ]);

  return {
    businessDoctor: { totalAnalyses: analysisCount, latest: latestAnalysis ? { businessName: latestAnalysis.businessName, industry: latestAnalysis.industry, createdAt: latestAnalysis.createdAt } : null },
    content: { totalPosts: postCount, latest: latestPosts },
    social: { totalPosts: socialCount, latest: latestSocial },
    sales: { totalContacts: totalLeads, needingFollowUp: leadsNeedingFollowUp },
    data: {
      revenueLast30d: (revenue30d as { _sum: { amount: number | null } })._sum.amount || 0,
      usageEventsLast30d: usageCount30d,
      platformProviderIssuesLast30d: fallbackIssues30d,
      providerFailureBreakdown: fallbackBreakdown30d.map((f) => ({ provider: f.fromProvider, failures: f._count.fromProvider })),
    },
    memories,
  };
}

export type BusinessSnapshot = Awaited<ReturnType<typeof buildBusinessSnapshot>>;
