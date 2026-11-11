export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const PAGE_SIZE = 20;

/**
 * Customer accounts for the new design's admin finance pages, read-only:
 * view=customers lists accounts with at least one order (the classic
 * /admin/financial/customers page), view=subscriptions lists paid-plan
 * accounts with the classic /admin/subscriptions summary figures. Expiry
 * changes keep using POST /api/admin/financial/expiry.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return (await requireAuth(req)) ? forbiddenResponse(req) : unauthorizedResponse(req);

  const p = req.nextUrl.searchParams;
  const view = p.get("view") === "subscriptions" ? "subscriptions" : "customers";
  const q = (p.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(p.get("page"))) || 1));
  const expiry = p.get("expiry");
  const now = new Date();
  const where = {
    ...(view === "subscriptions" ? { plan: { not: "FREE" } } : { payments: { some: {} } }),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
    ...(expiry === "expired" ? { planExpiry: { lt: now } } : expiry === "active" ? { planExpiry: { gte: now } } : expiry === "week" ? { planExpiry: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } : {}),
  };

  const [users, count, active, expired, expiringWeek, monthRevenue] = await Promise.all([
    prisma.user.findMany({
      where, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      orderBy: view === "subscriptions" ? [{ planExpiry: "desc" }, { id: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, email: true, phone: true, plan: true, planExpiry: true, crmPlan: true, crmPlanExpiry: true, voicePlanExpiry: true, credits: true, isBlocked: true, createdAt: true, _count: { select: { payments: true } } },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { gte: now } } }),
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { lt: now } } }),
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, _sum: { amount: true } }),
  ]);
  const ids = users.map((u) => u.id);
  const [sums, history] = await Promise.all([
    prisma.payment.groupBy({ by: ["userId", "transferCurrency", "gateway"], where: { userId: { in: ids }, status: "SUCCESS" }, _sum: { amount: true, transferMinor: true }, _count: { _all: true } }),
    prisma.auditLog.findMany({ where: { targetId: { in: ids }, action: "subscription_expiry_adjusted" }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, targetId: true, createdAt: true, metadata: true } }),
  ]);

  const customers = users.map((u) => ({
    ...u,
    paid: sums.filter((s) => s.userId === u.id).map((s) => ({ gateway: s.gateway, currency: s.transferCurrency, count: s._count._all, amount: s._sum.amount || 0, transferMinor: s._sum.transferMinor || 0 })),
    expiryHistory: history.filter((h) => h.targetId === u.id).map((h) => {
      let info: { subscription?: string; before?: string; after?: string; reason?: string } = {};
      try { info = JSON.parse(h.metadata || "{}"); } catch { /* old rows without metadata */ }
      return { id: h.id, createdAt: h.createdAt, subscription: info.subscription ?? null, before: info.before ?? null, after: info.after ?? null, reason: info.reason ?? null };
    }),
  }));

  return NextResponse.json({
    view, customers, total: count, page, totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    summary: { active, expired, expiringWeek, monthRevenue: monthRevenue._sum.amount || 0 },
  });
}
