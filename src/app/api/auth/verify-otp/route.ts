export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
    }

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "کد تأیید اشتباه یا منقضی است" }, { status: 400 });
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          credits: 100,
          lastLoginAt: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role, plan: user.plan } });

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
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
