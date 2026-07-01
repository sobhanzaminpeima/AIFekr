import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";
import { prisma } from "@/lib/db/prisma";

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      plan: true,
      credits: true,
      planExpiry: true,
      isBlocked: true,
    },
  });

  if (!user || user.isBlocked) return null;
  return user;
}

export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return null;
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "احراز هویت الزامی است" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
}
