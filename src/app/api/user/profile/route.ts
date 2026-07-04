export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      plan: true, credits: true, planExpiry: true, createdAt: true,
      authProvider: true,
    },
  });

  return NextResponse.json({ user: full });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { name, avatar } = await req.json();
  const data: { name?: string; avatar?: string } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim().slice(0, 60);
  if (typeof avatar === "string") data.avatar = avatar.slice(0, 500);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "چیزی برای ذخیره وجود ندارد" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ success: true, user: { name: updated.name, avatar: updated.avatar } });
}
