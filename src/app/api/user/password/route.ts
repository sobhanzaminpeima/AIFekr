export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  }

  const full = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, authProvider: true } });

  // Accounts created via Google have no password yet — allow setting one
  // without requiring a "current password" the user never had.
  if (full?.passwordHash) {
    if (!currentPassword || hashPassword(currentPassword) !== full.passwordHash) {
      return NextResponse.json({ error: "رمز عبور فعلی نادرست است" }, { status: 401 });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  return NextResponse.json({ success: true });
}
