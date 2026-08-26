export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail, findUserByPhone, findUserByReferralCode, createUser } from "@/lib/repositories/userRepository";
import { generateUniqueReferralCode } from "@/lib/utils/referralCode";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, industryPackSlug, ref } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
    if (!email && !phone) return NextResponse.json({ error: "ایمیل یا موبایل الزامی است" }, { status: 400 });
    if (email && !password) return NextResponse.json({ error: "رمز عبور الزامی است" }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ error: "رمز عبور حداقل ۶ کاراکتر باشد" }, { status: 400 });

    // Check duplicates
    if (email) {
      const existing = await findUserByEmail(email);
      if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }
    if (phone) {
      const existing = await findUserByPhone(phone);
      if (existing) return NextResponse.json({ error: "این موبایل قبلاً ثبت شده است" }, { status: 409 });
    }

    // Find pack if provided
    let industryPackId: string | undefined;
    if (industryPackSlug) {
      const pack = await prisma.industryPack.findUnique({ where: { slug: industryPackSlug } });
      if (pack) industryPackId = pack.id;
    }

    // Resolve referrer (if a valid ?ref= code was passed) — silently
    // ignored if the code doesn't match anyone, so a stale/bad link never
    // blocks signup.
    let referredBy: string | undefined;
    if (ref && typeof ref === "string") {
      const referrer = await findUserByReferralCode(ref);
      if (referrer) referredBy = referrer.id;
    }

    // Every user gets their own referral code at signup — name-based when
    // possible (e.g. "sobhan"), falling back to a random code on collision
    // or when the name has no usable Latin characters.
    const referralCode = await generateUniqueReferralCode(name);

    const user = await createUser({
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      passwordHash: password ? await hashPassword(password) : undefined,
      industryPack: industryPackId ? { connect: { id: industryPackId } } : undefined,
      credits: 200,
      plan: "FREE",
      referralCode,
      referredBy,
    });

    const payload = { userId: user.id, role: user.role, plan: user.plan };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const secure = process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });

    response.cookies.set("token", token, { httpOnly: true, secure, sameSite: "lax", maxAge: 15 * 60 });
    response.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 });

    return response;
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
