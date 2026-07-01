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
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "ایمیل و رمز عبور را وارد کنید" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "ایمیل یا رمز اشتباه است" }, { status: 401 });
    }

    if (user.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: "ایمیل یا رمز اشتباه است" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "حساب شما مسدود شده است" }, { status: 403 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role, plan: user.plan },
    });

    const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https");

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isHttps ?? false,
      sameSite: "lax",
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isHttps ?? false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("login error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
