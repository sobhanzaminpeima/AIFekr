import type { Prisma } from "@prisma/client";
import { statfs, mkdir } from "node:fs/promises";
import path from "node:path";
import { artifactDirectory } from "./render";
import { FactoryError } from "./errors";

export const GAMING_PLAN = "GAMING_SHORTS_3";
export const GAMING_MAX_BYTES = 500_000_000;
export const GAMING_MAX_OPEN = 2;
export async function assertGamingCapacity(tx: Prisma.TransactionClient, userId: string, payment = false) {
  // A shared SQLite write serializes intake and checkout capacity decisions.
  await tx.siteSetting.upsert({ where: { key: "gamingIntakeLock" }, create: { key: "gamingIntakeLock", value: "1" }, update: { value: "1" } });
  const open = await tx.gamingShortsOrder.count({ where: { status: { in: ["DRAFT", "UPLOADED", "PENDING", "APPROVED", "REVISION_REQUESTED", "CANCEL_REQUESTED"] }, ...(payment ? { NOT: { userId, status: { in: ["DRAFT", "UPLOADED"] } } } : {}) } });
  const reservations = await tx.payment.count({ where: { plan: GAMING_PLAN, userId: { not: userId },
    OR: [{ status: "PENDING", createdAt: { gt: new Date(Date.now() - 20 * 60000) } }, { status: "SUCCESS", createdAt: { gt: new Date(Date.now() - 30 * 86400000) } }],
    NOT: { id: { in: (await tx.gamingShortsOrder.findMany({ where: { paymentId: { not: null } }, select: { paymentId: true } })).flatMap(o => o.paymentId ? [o.paymentId] : []) } } } });
  if (open + reservations >= GAMING_MAX_OPEN) throw new FactoryError("GAMING_CAPACITY_FULL", 409);
  if (payment) {
    const redeemed = await tx.gamingShortsOrder.findMany({ where: { userId, paymentId: { not: null } }, select: { paymentId: true } });
    if (await tx.payment.count({ where: { userId, plan: GAMING_PLAN, status: "SUCCESS", createdAt: { gt: new Date(Date.now() - 30 * 86400000) }, id: { notIn: redeemed.flatMap(o => o.paymentId ? [o.paymentId] : []) } } })) {
      throw new FactoryError("GAMING_UNUSED_PACKAGE", 409);
    }
  }
  const root = path.dirname(artifactDirectory("capacity-check"));
  await mkdir(root, { recursive: true });
  const disk = await statfs(root);
  if (disk.bavail * disk.bsize < 2_000_000_000) throw new FactoryError("STORAGE_FULL", 503);
}
