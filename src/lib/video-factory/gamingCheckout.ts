import type { Prisma } from "@prisma/client";
export function gamingOrderId(snapshot: string): string | null {
  try { const value = JSON.parse(snapshot).gamingOrderId; return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value) ? value : null; } catch { return null; }
}
export async function validateGamingCheckout(tx: Prisma.TransactionClient, userId: string, orderId: string) {
  const order = await tx.gamingShortsOrder.findFirst({ where: { id: orderId, userId, status: "UPLOADED", paymentId: null } });
  if (!order || !order.sourceSha256 || !order.sourceSeconds) throw Error("GAMING_UPLOAD_REQUIRED");
  return order;
}
/** Executed inside the same transaction that marks a bank payment SUCCESS. */
export async function attachPaidGamingOrder(tx: Prisma.TransactionClient, userId: string, paymentId: string, snapshot: string) {
  const id = gamingOrderId(snapshot);
  if (!id) return; // Existing, unbound package purchases still redeem through Submit.
  const order = await tx.gamingShortsOrder.findFirst({ where: { id, userId } });
  if (!order) throw Error("GAMING_UPLOAD_REQUIRED");
  if (order.paymentId === paymentId && order.status !== "UPLOADED") return;
  const changed = await tx.gamingShortsOrder.updateMany({ where: { id, userId, status: "UPLOADED", paymentId: null }, data: { paymentId, status: "PENDING" } });
  if (!changed.count) throw Error("GAMING_ORDER_ALREADY_PAID");
  const admins = await tx.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isBlocked: false }, select: { id: true } });
  await tx.notification.createMany({ data: admins.map(a => ({ userId: a.id, type: "economy_gaming_new", title: "سفارش جدید Gaming Shorts", body: "پرداخت تأیید شد؛ فایل آمادهٔ بررسی و تدوین است.", link: "/admin/users/requests?type=gaming", emailPending: true })) });
}
