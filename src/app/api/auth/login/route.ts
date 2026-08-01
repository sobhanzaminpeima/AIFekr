export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findUserByEmail, recordLogin } from "@/lib/repositories/userRepository";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "ایمیل و رمز عبور را وارد کنید" }, { status: 400 });
    }

    const user = await findUserByEmail(email);

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "ایمیل یا رمز اشتباه است" }, { status: 401 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "ایمیل یا رمز اشتباه است" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "حساب شما مسدود شده است" }, { status: 403 });
    }

    // Transparently upgrade pre-bcrypt (SHA-256) hashes to bcrypt on a
    // successful login — no forced password reset needed for the migration.
    await recordLogin(user.id, needsRehash ? await hashPassword(password) : undefined);

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role, plan: user.plan },
    });

    const secure = process.env.NODE_ENV === "production";

    response.cookies.set("token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("login error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
