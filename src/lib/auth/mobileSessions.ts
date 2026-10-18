import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { MOBILE_ACCESS_SECONDS, signMobileAccess, verifyMobileAccess } from "./jwt";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");
const newRefresh = (id: string) => `${id}.${randomBytes(32).toString("hex")}`;
function sessionId(token: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/.test(token) ? token.split(".")[0] : null;
}
function tokens(userId: string, id: string, refreshToken: string, expiresAt: Date) {
  return { accessToken: signMobileAccess(userId, id), refreshToken, expiresIn: MOBILE_ACCESS_SECONDS, refreshExpiresAt: expiresAt.toISOString(), sessionId: id };
}
export async function createMobileSession(userId: string, deviceName: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isBlocked: true } });
  if (!user || user.isBlocked) return null;
  const id = randomUUID(), refreshToken = newRefresh(id), expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.mobileSession.create({ data: { id, userId, deviceName: deviceName.slice(0, 80), refreshTokenHash: fingerprint(refreshToken), expiresAt } });
  return tokens(userId, id, refreshToken, expiresAt);
}
export async function mobileIdentity(accessToken: string) {
  const identity = verifyMobileAccess(accessToken);
  if (!identity || process.env.MOBILE_API_ENABLED !== "true") return null;
  const session = await prisma.mobileSession.findFirst({ where: { id: identity.sessionId, userId: identity.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  return session ? identity : null;
}
export async function rotateMobileSession(refreshToken: string) {
  const id = sessionId(refreshToken); if (!id) return null;
  const stored = await prisma.mobileSession.findUnique({ where: { id }, include: { user: { select: { isBlocked: true } } } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.user.isBlocked) return null;
  const hash = fingerprint(refreshToken);
  if (hash === stored.previousRefreshTokenHash) {
    // Only a proven previously-valid secret can revoke a replayed session.
    await prisma.mobileSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    return null;
  }
  if (hash !== stored.refreshTokenHash) return null;
  const next = newRefresh(id);
  const updated = await prisma.mobileSession.updateMany({
    where: { id, refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { refreshTokenHash: fingerprint(next), previousRefreshTokenHash: hash, lastUsedAt: new Date() },
  });
  return updated.count === 1 ? tokens(stored.userId, id, next, stored.expiresAt) : null;
}
export async function revokeByRefresh(refreshToken: string) {
  const id = sessionId(refreshToken); if (!id) return;
  await prisma.mobileSession.updateMany({ where: { id, refreshTokenHash: fingerprint(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}
