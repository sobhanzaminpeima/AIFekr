import { prisma } from "@/lib/db/prisma";
import { rankByRelevance } from "@/lib/rag/retrieve";
import { buildCrmSnapshot } from "@/lib/agents/crmSnapshot";

/** Aggregates real, existing data across every AiFekr tool for one user — shared by the on-demand API route and the autonomous cron job. */
export async function buildBusinessSnapshot(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    latestAnalysis, analysisCount,
    latestPosts, postCount,
    latestSocial, socialCount,
    leadsNeedingFollowUp, totalLeads,
    memories, contentLessons,
    revenue30d, usageCount30d, fallbackIssues30d, fallbackBreakdown30d,
    crm,
  ] = await Promise.all([
    prisma.businessAnalysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.businessAnalysis.count({ where: { userId } }),
    prisma.contentPost.findMany({ where: { userId }, orderBy: { publishedAt: "desc" }, take: 5, select: { title: true, publishedAt: true, externalStatus: true } }),
    prisma.contentPost.count({ where: { userId } }),
    prisma.socialPost.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { platform: true, topic: true, createdAt: true } }),
    prisma.socialPost.count({ where: { userId } }),
    prisma.crmContact.findMany({ where: { userId, status: { in: ["lead", "contacted"] } }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, name: true, phone: true, status: true, lastContact: true, company: true } }),
    prisma.crmContact.count({ where: { userId } }),
    prisma.businessMemory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 60 }),
    // Phase 5, proposal 2 — cross-team memory. The content pipeline's critic
    // records what actually worked ("comparison posts converted best"), but
    // until now only the content agents ever read it, so the CEO reasoned
    // about content with none of the content team's own findings. This is the
    // read half of that wiring; the write half (CEO's [content]/[seo] lessons
    // reaching the pipeline) lives in api/seo/agent-pipeline/run/route.ts.
    prisma.contentAgentLesson.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30, select: { text: true, embedding: true, agentKey: true, createdAt: true } }),
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
    buildCrmSnapshot(userId),
  ]);

  // Re-rank the memory candidates against what's actually happening in this
  // snapshot (business identity, recent content, follow-up load) instead of
  // always sending whichever 30 memories happen to be newest — keeps the
  // CEO prompt focused on memories relevant to today, not just recent ones.
  const relevanceQuery = [
    latestAnalysis?.businessName,
    latestAnalysis?.industry,
    ...latestPosts.map((p) => p.title),
    leadsNeedingFollowUp.length > 0 ? "پیگیری فروش لیدها" : "",
  ].filter(Boolean).join(" — ");
  const relevantMemories = relevanceQuery ? await rankByRelevance(memories, relevanceQuery, 15) : memories.slice(0, 15);

  // Capped deliberately low (3, vs 15 for the CEO's own memories): these are
  // another team's findings, useful as context but they must not crowd out
  // the CEO's own memory or inflate every prompt's token cost.
  const relevantContentLessons = relevanceQuery
    ? await rankByRelevance(contentLessons, relevanceQuery, 3)
    : contentLessons.slice(0, 3);

  return {
    businessDoctor: { totalAnalyses: analysisCount, latest: latestAnalysis ? { businessName: latestAnalysis.businessName, industry: latestAnalysis.industry, createdAt: latestAnalysis.createdAt } : null },
    content: { totalPosts: postCount, latest: latestPosts },
    social: { totalPosts: socialCount, latest: latestSocial },
    sales: {
      totalContacts: totalLeads,
      needingFollowUp: leadsNeedingFollowUp,
      pipelineValueOpen: crm.pipelineValueOpen,
      totalDealsOpen: crm.totalDealsOpen,
      winRate: crm.winRate,
      staleDeals: crm.staleDeals,
    },
    data: {
      revenueLast30d: (revenue30d as { _sum: { amount: number | null } })._sum.amount || 0,
      usageEventsLast30d: usageCount30d,
      platformProviderIssuesLast30d: fallbackIssues30d,
      providerFailureBreakdown: fallbackBreakdown30d.map((f) => ({ provider: f.fromProvider, failures: f._count.fromProvider })),
    },
    memories: relevantMemories,
    contentLessons: relevantContentLessons.map((l) => ({ agentKey: l.agentKey, text: l.text })),
  };
}

export type BusinessSnapshot = Awaited<ReturnType<typeof buildBusinessSnapshot>>;
