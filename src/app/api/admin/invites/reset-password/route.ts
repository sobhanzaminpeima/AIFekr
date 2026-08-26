export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/admin/invitePassword";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Admin "Invite to AIfekr" tool — (Re)generates a temporary password for
 * the invite page's "تولید مجدد" button. Separate from activate-trial
 * (phase 2) since this can be called any time, independent of trial
 * state, and explicitly overwrites an existing user's credentials — a
 * distinct, more sensitive action deserving its own audit action type.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const rl = rateLimit(`invite-reset-password:${admin.id}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `تعداد درخواست‌ها زیاد است — ${rl.retryAfterSec} ثانیه دیگر تلاش کنید` }, { status: 429 });
  }

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const tempPassword = generateTempPassword(user.name || "User");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "invite_password_reset", targetId: userId },
  });

  return NextResponse.json({ tempPassword });
}
