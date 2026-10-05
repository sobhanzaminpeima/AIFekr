export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { PAYMENT_HISTORY_PAGE_SIZE, paymentHistoryQuery, savedGatewayUrl } from "@/lib/payment/tracking";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const query = paymentHistoryQuery(req.nextUrl.searchParams);
  const [rows, pendingCount, reviewCount] = await Promise.all([
    prisma.payment.findMany({
      where: { userId: user.id, ...(query.statuses ? { status: { in: query.statuses } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * PAYMENT_HISTORY_PAGE_SIZE,
      take: PAYMENT_HISTORY_PAGE_SIZE + 1,
      select: { id: true, amount: true, plan: true, status: true, gateway: true, refId: true, createdAt: true, transferCurrency: true, transferMinor: true, receiptAt: true, reviewAt: true, reviewNote: true, bankSnapshot: true },
    }),
    prisma.payment.count({ where: { userId: user.id, status: "PENDING" } }),
    prisma.payment.count({ where: { userId: user.id, status: "PENDING", gateway: "bank_transfer", receiptAt: { not: null } } }),
  ]);
  const packages = await prisma.package.findMany({ where: { planCode: { in: Array.from(new Set(rows.slice(0, PAYMENT_HISTORY_PAGE_SIZE).map(row => row.plan))) } }, select: { planCode: true, name: true, nameEn: true } });
  const payments = rows.slice(0, PAYMENT_HISTORY_PAGE_SIZE).map(({ bankSnapshot, ...row }) => ({
    ...row,
    packageName: packages.find(pkg => pkg.planCode === row.plan)?.name || null,
    packageNameEn: packages.find(pkg => pkg.planCode === row.plan)?.nameEn || null,
    resumeUrl: row.status === "PENDING" ? savedGatewayUrl(row.gateway, bankSnapshot) : null,
  }));
  return NextResponse.json({ payments, page: query.page, hasMore: rows.length > PAYMENT_HISTORY_PAGE_SIZE, pendingCount, reviewCount }, { headers: { "Cache-Control": "private, no-store" } });
}
