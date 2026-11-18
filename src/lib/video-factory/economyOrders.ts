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
  expectedCredits: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(100),
}).strict();
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
export async function placeOrder(userId: string, input: unknown) {
  const { topic, channel, expectedCredits, idempotencyKey } = orderInput.parse(input);
  return prisma.$transaction(async tx => {
    await tx.videoFactoryStorageQuota.upsert({ where: { userId }, create: { userId }, update: { usedBytes: { increment: 0 } } });
    const previous = await tx.economyVideoOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (previous) {
      if (previous.topic !== topic || previous.channel !== channel || previous.credits !== expectedCredits) throw new FactoryError("IDEMPOTENCY_CONFLICT", 409);
      return orderView(previous);
    }
    const price = await economyQuote(userId, tx);
    if (!price) throw new FactoryError("PRICING_NOT_CONFIGURED", 503);
    if (price.credits !== expectedCredits) throw new FactoryError("COST_CHANGED", 409);
    const id = randomUUID();
    const charge = await reserveLoggedCredits(tx, userId, price.credits, { type: "video_factory", requestId: id,
      metadata: { feature: "economy_video", orderId: id, standardCredits: price.standardCredits, discountPercent: price.discountPercent } });
    if (!charge) throw new FactoryError("INSUFFICIENT_CREDITS", 402);
    return orderView(await tx.economyVideoOrder.create({ data: { id, userId, topic, channel, idempotencyKey,
      credits: price.credits, standardCredits: price.standardCredits, durationSeconds: price.durationSeconds, discountPercent: price.discountPercent } }));
  });
}
