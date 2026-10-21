import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { mobileIdentity } from "@/lib/auth/mobileSessions";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/utils/rateLimit";
import type { ChatPolicy } from "./policy";
export const guestCookie = "aifekr_chat_guest";
function sign(value: string) {
  const key = process.env.JWT_SECRET;
  if (!key) throw Error("GUEST_SIGNING_UNAVAILABLE");
  return createHmac("sha256", key)
    .update("aifekr-chat:" + value)
    .digest("hex");
}
export function guestToken(id: string) {
  return `${id}.${sign(id)}`;
}
export function verifyGuestToken(token?: string) {
  if (!token) return null;
  const [id, mac, ...extra] = token.split(".");
  if (
    extra.length ||
    !/^[a-f0-9]{48}$/.test(id ?? "") ||
    !/^[a-f0-9]{64}$/.test(mac ?? "")
  )
    return null;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(sign(id))) ? id : null;
}
export async function chatIdentity(req: NextRequest) {
  const token = req.cookies.get("token")?.value,
    bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1],
    payload = token
      ? verifyToken(token)
      : bearer
        ? await mobileIdentity(bearer)
        : null;
  if (payload) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        isBlocked: true,
        chatOnly: true,
        role: true,
      },
    });
    if (user?.isBlocked) throw Error("ACCOUNT_BLOCKED");
    if (user) return { key: `u:${user.id}`, user, guest: null };
  }
  const id = verifyGuestToken(req.cookies.get(guestCookie)?.value),
    guest = id
      ? await prisma.aiChatGuest.findFirst({
          where: { id, expiresAt: { gt: new Date() }, mergedUserId: null },
        })
      : null;
  return guest ? { key: `g:${guest.id}`, user: null, guest } : null;
}
export async function issueGuest(req: NextRequest, policy: ChatPolicy) {
  const ipHash = sign(
    `ip:${getClientIp(req.headers)}:${new Date().toISOString().slice(0, 10)}`,
  );
  if (
    (await prisma.aiChatGuest.count({
      where: { ipHash, createdAt: { gte: new Date(Date.now() - 86400000) } },
    })) >= 10
  )
    throw Error("GUEST_ISSUANCE_LIMIT");
  const id = randomBytes(24).toString("hex"),
    guest = await prisma.aiChatGuest.create({
      data: {
        id,
        ipHash,
        expiresAt: new Date(Date.now() + policy.guestTtlHours * 3600000),
      },
    });
  return guest;
}
export type ChatIdentity = NonNullable<
  Awaited<ReturnType<typeof chatIdentity>>
>;
