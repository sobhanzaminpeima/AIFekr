export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail, findUserByPhone, createUser } from "@/lib/repositories/userRepository";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "";
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  if (plan && plan !== "all") where.plan = plan;
  if (status === "blocked") where.isBlocked = true;
  if (status === "active") where.isBlocked = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        credits: true,
        isBlocked: true,
        planExpiry: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { conversations: true, payments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { name, email, phone, password, plan, credits } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "ایمیل یا موبایل الزامی است" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: "رمز عبور حداقل ۶ کاراکتر باشد" }, { status: 400 });

  if (email) {
    const existing = await findUserByEmail(email);
    if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
  }
  if (phone) {
    const existing = await findUserByPhone(phone);
    if (existing) return NextResponse.json({ error: "این موبایل قبلاً ثبت شده است" }, { status: 409 });
  }

  const referralCode = randomBytes(4).toString("hex");
  const user = await createUser({
    name: name.trim(),
    email: email || undefined,
    phone: phone || undefined,
    passwordHash: await hashPassword(password),
    credits: typeof credits === "number" ? credits : 200,
    plan: plan || "FREE",
    referralCode,
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone } }, { status: 201 });
}
