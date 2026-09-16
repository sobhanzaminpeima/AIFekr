export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findUserByEmail, recordLogin } from "@/lib/repositories/userRepository";
import { rateLimit, getClientIp } from "@/lib/utils/rateLimit";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function POST(req: NextRequest) {
  // Read before any user lookup: the `lang` cookie reflects the UI language
  // the user is looking at right now, not the account's saved preference
  // (that's only known after a successful login) -- these error strings were
  // hardcoded Persian regardless of it, so a German-UI user got "رمز عبور
  // اشتباه است" on a wrong password instead of the German string.
  const lang = await getServerLang();

  try {
    const ip = getClientIp(req.headers);
    const limit = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: tri(lang,
        "تعداد تلاش‌های ورود بیش از حد مجاز — کمی صبر کنید",
        "Too many login attempts — please wait a moment",
        "Zu viele Anmeldeversuche — bitte warten Sie einen Moment") }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: tri(lang,
        "ایمیل و رمز عبور را وارد کنید",
        "Please enter your email and password",
        "Bitte geben Sie E-Mail und Passwort ein") }, { status: 400 });
    }

    const user = await findUserByEmail(email);

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: tri(lang,
        "ایمیل یا رمز اشتباه است",
        "Incorrect email or password",
        "Falsche E-Mail oder falsches Passwort") }, { status: 401 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: tri(lang,
        "ایمیل یا رمز اشتباه است",
        "Incorrect email or password",
        "Falsche E-Mail oder falsches Passwort") }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: tri(lang,
        "حساب شما مسدود شده است",
        "Your account has been blocked",
        "Ihr Konto wurde gesperrt") }, { status: 403 });
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
      maxAge: 7 * 24 * 60 * 60, // matches signToken's expiresIn
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    // Restore the account's saved language preference on login -- the `lang`
    // cookie set at registration (or by LanguageSwitcher since) is just a
    // browser cookie, gone on a new device/browser or a cleared cookie jar.
    // Without this, login silently reverted to whatever the site default
    // happened to be instead of the language the user actually chose.
    if (user.language) {
      response.cookies.set("lang", user.language, { secure, sameSite: "lax", maxAge: 365 * 24 * 60 * 60 });
    }

    return response;
  } catch (error) {
    console.error("login error:", error);
    return NextResponse.json({ error: tri(lang, "خطای سرور", "Server error", "Serverfehler") }, { status: 500 });
  }
}
