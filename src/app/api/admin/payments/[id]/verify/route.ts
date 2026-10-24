import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { verifyPayment } from "@/lib/payment/zarinpal";
import { settleVerifiedPayment } from "@/lib/payment/reviewBankPayment";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "پرداخت پیدا نشد" }, { status: 404 });
  if (payment.gateway !== "zarinpal" || !payment.authority) return NextResponse.json({ error: "این پرداخت قابل استعلام از زرین‌پال نیست" }, { status: 409 });
  if (payment.status === "SUCCESS") return NextResponse.json({ success: true });
  if (payment.status !== "PENDING") return NextResponse.json({ error: "این پرداخت در انتظار تأیید نیست" }, { status: 409 });
  let snapshot;
  try { snapshot = JSON.parse(payment.entitlementSnapshot || "{}"); } catch { snapshot = {}; }
  if (!Number.isInteger(snapshot.credits) || !Number.isFinite(snapshot.days) || snapshot.days <= 0) return NextResponse.json({ error: "اطلاعات پکیج این سفارش ناقص است؛ بررسی فنی لازم است" }, { status: 409 });
  try {
    const result = await verifyPayment({ authority: payment.authority, amount: payment.amount });
    if (!result.ok || !result.refId) return NextResponse.json({ error: "زرین‌پال پرداخت را تأیید نکرد. وضعیت تراکنش را در پنل درگاه بررسی کنید." }, { status: 409 });
    await settleVerifiedPayment(payment.id, payment.authority, result.refId);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "payment_gateway_rechecked", targetId: payment.id, metadata: JSON.stringify({ gateway: "zarinpal", refId: result.refId }) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "استعلام یا ثبت تأیید انجام نشد؛ می‌توانید دوباره تلاش کنید." }, { status: 503 });
  }
}
