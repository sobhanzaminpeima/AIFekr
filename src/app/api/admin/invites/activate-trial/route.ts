export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail, findUserByPhone, createUser } from "@/lib/repositories/userRepository";
import { generateUniqueReferralCode } from "@/lib/utils/referralCode";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Admin "Invite to AIfekr" tool — activates a Pro trial + (optionally) the
 * full real-estate package for a new or existing user.
 *
 * Entitlement is enforced through the SAME fields every plan-gated feature
 * already checks (plan/planExpiry, crmPlan, industryPackId) — trialPlan/
 * trialStartsAt/trialEndsAt/realEstatePackage are an audit record of *why*,
 * not a second entitlement system.
 *
 * Password generation deliberately does NOT happen here for a new user —
 * see the comment below where the account is created. It lives only in
 * POST /api/admin/invites/reset-password, so there is never a moment where
 * two different "real" temp passwords exist for the same account and an
 * admin can't tell which one actually works.
 */

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const rl = rateLimit(`invite-activate:${admin.id}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `تعداد درخواست‌ها زیاد است — ${rl.retryAfterSec} ثانیه دیگر تلاش کنید` }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, name, email, phone, trialDays, realEstatePackage } = body as {
    userId?: string; name?: string; email?: string; phone?: string; trialDays?: number; realEstatePackage?: boolean;
  };

  const wantsRealEstate = realEstatePackage !== false; // ticked by default per spec
  const days = Number.isFinite(trialDays) && (trialDays as number) > 0 && (trialDays as number) <= 90 ? (trialDays as number) : 7;

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  let realEstatePack: { id: string } | null = null;
  if (wantsRealEstate) {
    realEstatePack = await prisma.industryPack.findUnique({ where: { slug: "real-estate" }, select: { id: true } });
    if (!realEstatePack) {
      return NextResponse.json({ error: "پک صنعتی «املاک» در سیستم یافت نشد" }, { status: 500 });
    }
  }

  let targetUserId: string;
  let isNewUser = false;

  if (userId) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, referralCode: true } });
    if (!existing) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    targetUserId = existing.id;

    // Single source of truth for the referral link: generate it now only if
    // this user has never had one, so it's stable from this point forward —
    // never a second/parallel code, never regenerated once it exists.
    let referralCode = existing.referralCode;
    if (!referralCode) referralCode = await generateUniqueReferralCode(existing.name);

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        plan: "PRO",
        planExpiry: trialEndsAt,
        trialPlan: "pro_trial_7d",
        trialStartsAt: now,
        trialEndsAt,
        realEstatePackage: wantsRealEstate,
        ...(wantsRealEstate ? { industryPackId: realEstatePack!.id, crmPlan: "SOLO", crmPlanExpiry: trialEndsAt } : {}),
        referralCode,
        invitedByAdminId: admin.id,
        invitedAt: now,
      },
    });
  } else {
    if (!name?.trim()) return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
    if (!email && !phone) return NextResponse.json({ error: "ایمیل یا موبایل الزامی است" }, { status: 400 });
    if (email) {
      const clash = await findUserByEmail(email);
      if (clash) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }
    if (phone) {
      const clash = await findUserByPhone(phone);
      if (clash) return NextResponse.json({ error: "این موبایل قبلاً ثبت شده است" }, { status: 409 });
    }

    isNewUser = true;
    // Deliberately NOT generateTempPassword() here — that's reserved for
    // the one canonical place a communicable password is created
    // (POST /api/admin/invites/reset-password, on the invite page's
    // "Generate Password" button). If this endpoint also handed out a
    // usable temp password, an admin who later clicks "Generate" on the
    // invite page would silently invalidate a password they (or the
    // customer) might already have seen/copied, with no way to tell which
    // one is "the real one" — see reset-password/route.ts for the full
    // rationale. This placeholder is a long random secret NEVER returned
    // to the client or logged anywhere; the account simply can't log in
    // with a password until the admin explicitly generates one.
    const placeholderPassword = randomBytes(24).toString("hex");
    const referralCode = await generateUniqueReferralCode(name);

    const created = await createUser({
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      passwordHash: await hashPassword(placeholderPassword),
      credits: 200,
      plan: "PRO",
      planExpiry: trialEndsAt,
      trialPlan: "pro_trial_7d",
      trialStartsAt: now,
      trialEndsAt,
      realEstatePackage: wantsRealEstate,
      ...(wantsRealEstate ? { industryPack: { connect: { id: realEstatePack!.id } }, crmPlan: "SOLO", crmPlanExpiry: trialEndsAt } : {}),
      referralCode,
      mustChangePassword: true,
      invitedByAdminId: admin.id,
      invitedAt: now,
    });
    targetUserId = created.id;
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "trial_activated",
      targetId: targetUserId,
      metadata: JSON.stringify({ trialDays: days, realEstatePackage: wantsRealEstate, isNewUser }),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, phone: true, referralCode: true },
  });

  return NextResponse.json({
    user,
    isNewUser,
    trialEndsAt,
  });
}
