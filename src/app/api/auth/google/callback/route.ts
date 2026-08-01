export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";

function getRedirectUri(req: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${appUrl}/api/auth/google/callback`;
}

function fail(req: NextRequest, reason: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(reason)}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("google_oauth_state")?.value;

  if (!code) return fail(req, "کد ورود گوگل دریافت نشد");
  if (!state || !savedState || state !== savedState) return fail(req, "درخواست ورود نامعتبر است");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(req, "ورود با گوگل پیکربندی نشده است");

  try {
    // Exchange the authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail(req, "خطا در دریافت اعتبار از گوگل");
    const tokens = await tokenRes.json();

    // Fetch the Google profile (id, email, name, picture)
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return fail(req, "خطا در دریافت پروفایل گوگل");
    const profile = await profileRes.json() as { id: string; email?: string; name?: string; picture?: string };

    if (!profile.email) return fail(req, "ایمیل حساب گوگل در دسترس نیست");

    // Match by googleId first, then by existing email (linking an
    // existing password-based account to Google on first Google sign-in).
    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.id, authProvider: "google", avatar: user.avatar || profile.picture },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name || profile.email.split("@")[0],
            avatar: profile.picture,
            googleId: profile.id,
            authProvider: "google",
          },
        });
      }
    }

    if (user.isBlocked) return fail(req, "حساب شما مسدود شده است");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const dest = (user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? "/admin/dashboard" : "/chat";
    const secure = process.env.NODE_ENV === "production";

    const res = NextResponse.redirect(`${appUrl}${dest}`);
    res.cookies.set("token", token, { httpOnly: true, secure, sameSite: "lax", maxAge: 15 * 60 });
    res.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 });
    res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return fail(req, "خطای سرور در ورود با گوگل");
  }
}
