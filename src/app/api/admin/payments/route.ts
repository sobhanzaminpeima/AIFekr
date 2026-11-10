export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const STATUSES = ["PENDING", "SUCCESS", "REJECTED", "FAILED", "CANCELLED"];
const PAGE_SIZE = 20;

/**
 * The payment register for the new design's admin finance page: the same rows,
 * totals, referral commission and payout figures the classic /admin/financial
 * page reads from the database, as JSON. Read-only; reviews keep using
 * PATCH /api/admin/payments/<id>, /verify and /notify.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return (await requireAuth(req)) ? forbiddenResponse(req) : unauthorizedResponse(req);

  const q = req.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(q.get("page"))) || 1));
  const status = STATUSES.includes(q.get("status") || "") ? q.get("status")! : undefined;
  const userId = q.get("userId") || undefined;
  const search = (q.get("search") || "").trim().slice(0, 100);
  const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00Z") : undefined);
  const from = day(q.get("from"));
  const to = day(q.get("to"));
  const where = {
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}) } } : {}),
    ...(search ? { OR: [{ id: { contains: search } }, { plan: { contains: search } }, { user: { email: { contains: search } } }, { user: { name: { contains: search } } }, { user: { phone: { contains: search } } }] } : {}),
  };

  const [payments, count, totals, buyers, commissions, payouts] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, userId: true, plan: true, amount: true, status: true, gateway: true, transferMinor: true, transferCurrency: true, receiptAt: true, reviewNote: true, notificationSentAt: true, notificationError: true, createdAt: true, user: { select: { name: true, email: true, phone: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ["status", "transferCurrency", "gateway"], _sum: { amount: true, transferMinor: true }, _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["userId"], where: { status: "SUCCESS" } }),
    prisma.walletTransaction.aggregate({ where: { type: "commission" }, _sum: { amount: true }, _count: true }),
    prisma.walletPayoutRequest.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
  ]);

  return NextResponse.json({
    payments: payments.map((p) => ({ ...p, notificationError: p.notificationError ? true : false })),
    total: count,
    page,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    totals: totals.map((g) => ({ status: g.status, gateway: g.gateway, currency: g.transferCurrency, count: g._count._all, amount: g._sum.amount || 0, transferMinor: g._sum.transferMinor || 0 })),
    buyers: buyers.length,
    commission: { amount: commissions._sum.amount || 0, count: commissions._count },
    payouts: payouts.map((p) => ({ status: p.status, amount: p._sum.amount || 0, count: p._count })),
  });
}
