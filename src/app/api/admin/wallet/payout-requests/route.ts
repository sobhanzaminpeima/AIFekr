export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.walletPayoutRequest.findMany({
    where: status ? { status } : {},
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ requests });
}

// Resolves a pending payout request. "paid" assumes the admin already sent
// the money manually outside this app (bank transfer / PayPal) — this route
// never triggers a transfer itself, only records that one already happened.
// "rejected" refunds the reserved amount back to the user's wallet.
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, adminNote } = await req.json();
  if (!["paid", "rejected"].includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  const existing = await prisma.walletPayoutRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  if (existing.status !== "pending") return NextResponse.json({ error: "این درخواست قبلاً بررسی شده است" }, { status: 409 });

  if (status === "rejected") {
    await prisma.$transaction([
      prisma.walletPayoutRequest.update({ where: { id }, data: { status, adminNote, resolvedAt: new Date(), resolvedById: admin.id } }),
      prisma.user.update({ where: { id: existing.userId }, data: { walletBalance: { increment: existing.amount } } }),
      prisma.walletTransaction.create({
        data: { userId: existing.userId, type: "payout_rejected_refund", amount: existing.amount, payoutRequestId: id, note: adminNote || "درخواست برداشت رد شد — مبلغ بازگشت داده شد" },
      }),
    ]);
  } else {
    await prisma.walletPayoutRequest.update({ where: { id }, data: { status, adminNote, resolvedAt: new Date(), resolvedById: admin.id } });
  }

  const updated = await prisma.walletPayoutRequest.findUnique({ where: { id } });
  return NextResponse.json({ payoutRequest: updated });
}
