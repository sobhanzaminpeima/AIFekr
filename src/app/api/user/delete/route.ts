export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // OtpCode/CrmContact hold an optional (nullable) userId with no explicit
  // cascade — clear those first so prisma.user.delete() doesn't hit a
  // foreign key constraint. Every other relation cascades automatically.
  await prisma.otpCode.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await prisma.crmContact.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await prisma.user.delete({ where: { id: user.id } });

  const res = NextResponse.json({ success: true });
  res.cookies.set("token", "", { maxAge: 0, path: "/" });
  return res;
}
