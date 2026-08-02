import { prisma } from "@/lib/db/prisma";

export interface StaleDeal {
  id: string;
  title: string;
  contactName: string;
  daysSinceUpdate: number;
  value: number;
}

export interface LeadSourceStat {
  source: string;
  total: number;
  converted: number;
  conversionRate: number;
}

export interface CrmSnapshot {
  pipelineValueOpen: number;
  totalDealsOpen: number;
  winRate: number | null; // % of closed (won+lost) deals in the last 90 days that were won
  avgSalesCycleDays: number | null; // avg days from creation to wonAt, for deals won in the last 90 days
  staleDeals: StaleDeal[]; // open deals with no activity/update in 7+ days
  leadSources: LeadSourceStat[]; // per-source conversion rate, sorted best-first
  totalContacts: number;
}

/**
 * Computes real CRM metrics from the database — deliberately arithmetic, not
 * left for the model to estimate from a data dump. The model gets these
 * numbers pre-calculated and only reasons about what they mean.
 */
export async function buildCrmSnapshot(userId: string): Promise<CrmSnapshot> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openDeals, closedDeals90d, staleDealRows, contacts, totalContacts] = await Promise.all([
    prisma.crmDeal.findMany({ where: { userId, status: "open" }, select: { value: true } }),
    prisma.crmDeal.findMany({
      where: { userId, status: { in: ["won", "lost"] }, updatedAt: { gte: ninetyDaysAgo } },
      select: { status: true, createdAt: true, wonAt: true },
    }),
    prisma.crmDeal.findMany({
      where: { userId, status: "open", updatedAt: { lt: staleThreshold } },
      include: { contact: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),
    prisma.crmContact.findMany({ where: { userId }, select: { source: true, status: true } }),
    prisma.crmContact.count({ where: { userId } }),
  ]);

  const pipelineValueOpen = openDeals.reduce((sum, d) => sum + d.value, 0);

  const wonCount = closedDeals90d.filter((d) => d.status === "won").length;
  const winRate = closedDeals90d.length > 0 ? Math.round((wonCount / closedDeals90d.length) * 100) : null;

  const cycleDays = closedDeals90d
    .filter((d) => d.status === "won" && d.wonAt)
    .map((d) => (d.wonAt!.getTime() - d.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const avgSalesCycleDays = cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null;

  const staleDeals: StaleDeal[] = staleDealRows.map((d) => ({
    id: d.id,
    title: d.title,
    contactName: d.contact.name,
    daysSinceUpdate: Math.floor((Date.now() - d.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    value: d.value,
  }));

  const sourceMap = new Map<string, { total: number; converted: number }>();
  for (const c of contacts) {
    const key = c.source || "manual";
    const entry = sourceMap.get(key) || { total: 0, converted: 0 };
    entry.total++;
    if (c.status === "customer") entry.converted++;
    sourceMap.set(key, entry);
  }
  const leadSources: LeadSourceStat[] = Array.from(sourceMap.entries())
    .map(([source, { total, converted }]) => ({ source, total, converted, conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0 }))
    .sort((a, b) => b.conversionRate - a.conversionRate);

  return { pipelineValueOpen, totalDealsOpen: openDeals.length, winRate, avgSalesCycleDays, staleDeals, leadSources, totalContacts };
}
