import { randomUUID } from "node:crypto";
import type { EconomyVideoOrder, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { reserveLoggedCredits } from "@/lib/utils/teamCredits";
import { configurationSchema, FactoryError, quote } from "./domain";
import { getPolicy } from "./config";
import { policyForBundle } from "./bundlePolicy";
import { DEFAULT_ECONOMY_DISCOUNT_PERCENT, economyPrice } from "./economyPrice";

const discountKey = "videoFactoryEconomyDiscountPercent";
export const discountSchema = z.object({ discountPercent: z.number().int().min(1).max(99) }).strict();
const orderInput = z.object({
  topic: z.string().trim().min(1).max(2000),
  channel: z.string().trim().min(1).max(500),
  expectedCredits: z.number().int().positive().optional(),
  paymentId: z.string().min(1).max(150).optional(),
  idempotencyKey: z.string().min(8).max(100),
}).strict().refine(v => Boolean(v.paymentId) !== (v.expectedCredits !== undefined));
const standard = configurationSchema.parse({
  durationSeconds: 300, language: "fa", ratio: "16:9", mode: "AUTOPILOT",
  quality: "SMART", budgetCap: 1_000_000, mediaMode: "MULTIMEDIA",
});
export async function getDiscount(db: Prisma.TransactionClient = prisma) {
  const setting = await db.siteSetting.findUnique({ where: { key: discountKey } });
  return setting ? Number(setting.value) : DEFAULT_ECONOMY_DISCOUNT_PERCENT;
}
export async function setDiscount(actorId: string, input: unknown) {
  const { discountPercent } = discountSchema.parse(input);
  const value = String(discountPercent);
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: discountKey }, create: { key: discountKey, value }, update: { value } }),
    prisma.auditLog.create({ data: { actorId, action: "video_factory.economy_discount", metadata: JSON.stringify({ discountPercent }) } }),
  ]);
  return { discountPercent };
}
export async function economyQuote(userId: string, db: Prisma.TransactionClient = prisma) {
  const policy = await policyForBundle(db, userId, standard.durationSeconds, await getPolicy(db));
  if (!policy.enabled || process.env.VIDEO_FACTORY_SALES_APPROVED !== "true" ||
    (policy.commercial.mode === "DURATION_RETAIL" && policy.commercial.status !== "APPROVED")) return null;
  const discountPercent = await getDiscount(db);
  try {
    const standardCredits = quote(standard, policy).credits;
    return { standardCredits, credits: economyPrice(standardCredits, discountPercent), discountPercent, durationSeconds: standard.durationSeconds };
  } catch (error) {
    if (error instanceof FactoryError || error instanceof RangeError) return null;
    throw error;
  }
}
export function orderView(row: EconomyVideoOrder) {
  const { deliveryKey, idempotencyKey, deliveredBy, tags, ...fields } = row;
  const prefix = "/api/video-factory/economy/" + row.id;
  return { ...fields, tags: JSON.parse(tags) as string[], videoUrl: deliveryKey ? prefix + "/video" : null,
    thumbnailUrl: deliveryKey ? prefix + "/thumbnail" : null };
}
export async function listOrders(userId?: string) {
  const rows = await prisma.economyVideoOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map(orderView);
}
export async function manualEntitlement(userId: string, db: Prisma.TransactionClient = prisma, paymentId?: string) {
  const redeemed = await db.economyVideoOrder.findMany({where:{userId,paymentId:{not:null}},select:{paymentId:true}});
  const payments = await db.payment.findMany({where:{userId,plan:"VF_ECONOMY_10",status:"SUCCESS",
    id:{equals:paymentId,notIn:redeemed.flatMap(r=>r.paymentId?[r.paymentId]:[])}},orderBy:{createdAt:"asc"},
    select:{id:true,createdAt:true,reviewAt:true,entitlementSnapshot:true}});
  for(const payment of payments){
    const snapshot=JSON.parse(payment.entitlementSnapshot);
    if(snapshot.category==="VIDEO_FACTORY" && snapshot.entitlements?.limits?.manualDelivery===1 &&
      Number.isInteger(snapshot.days) && (payment.reviewAt??payment.createdAt).getTime()+snapshot.days*86400000>Date.now()){
      return {paymentId:payment.id,durationSeconds:600};
    }
  }
  return null;
}
export async function placeOrder(userId: string, input: unknown) {
  const { topic, channel, expectedCredits, idempotencyKey, paymentId } = orderInput.parse(input);
  return prisma.$transaction(async tx => {
    await tx.videoFactoryStorageQuota.upsert({ where: { userId }, create: { userId }, update: { usedBytes: { increment: 0 } } });
    const previous = await tx.economyVideoOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (previous) {
      if (previous.topic !== topic || previous.channel !== channel || previous.paymentId !== (paymentId??null) || (!paymentId && previous.credits !== expectedCredits)) throw new FactoryError("IDEMPOTENCY_CONFLICT", 409);
      return orderView(previous);
    }
    const entitlement = paymentId ? await manualEntitlement(userId,tx,paymentId) : null;
    if(paymentId && !entitlement) throw new FactoryError("MANUAL_PACKAGE_REQUIRED_OR_EXHAUSTED",402);
    const price = entitlement ? {credits:0,standardCredits:0,discountPercent:0,durationSeconds:600} : await economyQuote(userId, tx);
    if (!price) throw new FactoryError("PRICING_NOT_CONFIGURED", 503);
    if (!paymentId && price.credits !== expectedCredits) throw new FactoryError("COST_CHANGED", 409);
    const id = randomUUID();
    const charge = paymentId || await reserveLoggedCredits(tx, userId, price.credits, { type: "video_factory", requestId: id,
      metadata: { feature: "economy_video", orderId: id, standardCredits: price.standardCredits, discountPercent: price.discountPercent } });
    if (!charge) throw new FactoryError("INSUFFICIENT_CREDITS", 402);
    const order = await tx.economyVideoOrder.create({ data: { id, userId, topic, channel, idempotencyKey, paymentId,
      credits: price.credits, standardCredits: price.standardCredits, durationSeconds: price.durationSeconds, discountPercent: price.discountPercent } });
    const admins = await tx.user.findMany({where:{role:{in:["ADMIN","SUPER_ADMIN"]},isBlocked:false}, select:{id:true}});
    if (admins.length) await tx.notification.createMany({data:admins.map(admin => ({
      userId:admin.id,type:"economy_order_new",title:"درخواست جدید ویدیوی اقتصادی",
      body:topic,link:"/admin/users/requests",emailPending:true,
    }))});
    return orderView(order);
  });
}

const actionSchema = z.object({ action: z.enum(["APPROVE","NOTIFY_DELIVERY"]), orderId: z.string().uuid() }).strict();
export async function updateEconomyOrder(actorId: string, input: unknown) {
  const { action, orderId } = actionSchema.parse(input);
  const approve = action === "APPROVE";
  return prisma.$transaction(async tx => {
    const now = new Date();
    const changed = await tx.economyVideoOrder.updateMany({
      where: approve ? { id:orderId, status:"PENDING" } : { id:orderId, status:"DELIVERED", deliveryNotificationQueuedAt:null },
      data: approve ? { status:"APPROVED", approvedAt:now } : { deliveryNotificationQueuedAt:now },
    });
    const order = await tx.economyVideoOrder.findUnique({where:{id:orderId}});
    if (!order) throw new FactoryError("ORDER_NOT_FOUND",404);
    if (!approve && order.status !== "DELIVERED") throw new FactoryError("ORDER_NOT_DELIVERED",409);
    if (changed.count) {
      await tx.notification.create({data:{userId:order.userId, emailPending:true, type:approve?"economy_order_approved":"economy_order_ready",
        title:approve?"سفارش ویدیوی اقتصادی شما تأیید شد":"ویدیوی اقتصادی شما آماده است",
        body:approve?`موضوع: ${order.topic}. می‌توانید وضعیت سفارش را در پروفایل خود ببینید.`:`ویدیو، تصویر بندانگشتی و اطلاعات انتشار «${order.title || order.topic}» را از پروفایل خود دریافت کنید.`,
        link:"/settings?tab=economy",
      }});
      await tx.auditLog.create({data:{actorId,targetId:orderId,action:approve?"video_factory.economy_approved":"video_factory.economy_delivery_notified"}});
    }
    return orderView(order);
  });
}
