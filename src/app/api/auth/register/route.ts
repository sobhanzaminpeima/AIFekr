export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail, findUserByPhone, findUserByReferralCode, createUser } from "@/lib/repositories/userRepository";
import { generateUniqueReferralCode } from "@/lib/utils/referralCode";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const VALID_LANGS = new Set(["fa", "en", "de"]);

export async function POST(req: NextRequest) {
  // Every message below was hardcoded Persian regardless of which language the
  // registration form was actually shown in -- an English/German user got
  // "نام الزامی است" on a missing name. The request body's own `language`
  // (the picker on the form) is the real signal here, since this runs before
  // any `lang` cookie exists for a brand-new visitor; getServerLang() is the
  // fallback for the rare case a cookie is already set (e.g. a retry).
  const bodyForLang = await req.json().catch(() => ({}));
  const lang = VALID_LANGS.has(bodyForLang?.language) ? bodyForLang.language : await getServerLang();

  try {
    const { name, firstName, lastName, country, language, email, phone, password, industryPackSlug, ref } = bodyForLang;

    // firstName/lastName are the primary fields going forward; `name` (kept
    // for every existing caller that reads user.name) is derived from them
    // when they're present, falling back to the legacy single-field input.
    const composedName = firstName?.trim()
      ? `${firstName.trim()}${lastName?.trim() ? ` ${lastName.trim()}` : ""}`
      : name?.trim();

    if (!composedName) return NextResponse.json({ error: tri(lang, "نام الزامی است", "Name is required", "Name ist erforderlich") }, { status: 400 });
    if (!email && !phone) return NextResponse.json({ error: tri(lang, "ایمیل یا موبایل الزامی است", "Email or phone is required", "E-Mail oder Telefonnummer ist erforderlich") }, { status: 400 });
    if (email && !password) return NextResponse.json({ error: tri(lang, "رمز عبور الزامی است", "Password is required", "Passwort ist erforderlich") }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ error: tri(lang, "رمز عبور حداقل ۶ کاراکتر باشد", "Password must be at least 6 characters", "Das Passwort muss mindestens 6 Zeichen lang sein") }, { status: 400 });

    // Check duplicates
    if (email) {
      const existing = await findUserByEmail(email);
      if (existing) return NextResponse.json({ error: tri(lang, "این ایمیل قبلاً ثبت شده است", "This email is already registered", "Diese E-Mail-Adresse ist bereits registriert") }, { status: 409 });
    }
    if (phone) {
      const existing = await findUserByPhone(phone);
      if (existing) return NextResponse.json({ error: tri(lang, "این موبایل قبلاً ثبت شده است", "This phone number is already registered", "Diese Telefonnummer ist bereits registriert") }, { status: 409 });
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
    const referralCode = await generateUniqueReferralCode(composedName);

    const user = await createUser({
      name: composedName,
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      country: typeof country === "string" && country.trim() ? country.trim().toUpperCase().slice(0, 10) : undefined,
      // Persisted (not just set as a cookie below) so it survives a future
      // login from a cleared cookie jar or a different device/browser --
      // see the `language` field's doc comment in schema.prisma.
      language: VALID_LANGS.has(language) ? language : undefined,
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

    response.cookies.set("token", token, { httpOnly: true, secure, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 });
    response.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 });
    // The default-language picker on the registration form should take
    // effect immediately, not just be recorded and ignored -- same cookie
    // LanguageSwitcher sets, so the very first page after signup already
    // renders in the chosen language instead of whatever the browser/site
    // default happened to be.
    if (VALID_LANGS.has(language)) {
      response.cookies.set("lang", language, { secure, sameSite: "lax", maxAge: 365 * 24 * 60 * 60 });
    }

    return response;
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json({ error: tri(lang, "خطای سرور", "Server error", "Serverfehler") }, { status: 500 });
  }
}
