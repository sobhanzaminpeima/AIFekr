export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, industryPackSlug } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
    if (!email && !phone) return NextResponse.json({ error: "ایمیل یا موبایل الزامی است" }, { status: 400 });
    if (email && !password) return NextResponse.json({ error: "رمز عبور الزامی است" }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ error: "رمز عبور حداقل ۶ کاراکتر باشد" }, { status: 400 });

    // Check duplicates
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }
    if (phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) return NextResponse.json({ error: "این موبایل قبلاً ثبت شده است" }, { status: 409 });
    }

    // Find pack if provided
    let industryPackId: string | undefined;
    if (industryPackSlug) {
      const pack = await prisma.industryPack.findUnique({ where: { slug: industryPackSlug } });
      if (pack) industryPackId = pack.id;
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email || undefined,
        phone: phone || undefined,
        passwordHash: password ? hashPassword(password) : undefined,
        industryPackId,
        credits: 200,
        plan: "FREE",
      },
    });

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https");
    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });

    response.cookies.set("token", token, { httpOnly: true, secure: isHttps ?? false, sameSite: "lax", maxAge: 15 * 60 });
    response.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure: isHttps ?? false, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 });

    return response;
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
