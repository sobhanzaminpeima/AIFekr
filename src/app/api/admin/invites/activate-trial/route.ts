export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail, findUserByPhone, findUserByReferralCode, createUser } from "@/lib/repositories/userRepository";
import { generateTempPassword } from "@/lib/admin/invitePassword";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Admin "Invite to AIfekr" tool — phase 2: activates a 7-day Pro trial +
 * (optionally) the full real-estate package for a new or existing user,
 * from the admin Users section. No card/UI yet (phase 3+) — this is the
 * activation endpoint + audit trail only.
 *
 * Entitlement is enforced through the SAME fields every plan-gated feature
 * already checks (plan/planExpiry, crmPlan, industryPackId) — trialPlan/
 * trialStartsAt/trialEndsAt/realEstatePackage are an audit record of *why*,
 * not a second entitlement system.
 */

function generateReferralCode(): string {
  return randomBytes(4).toString("hex");
}

async function uniqueReferralCode(): Promise<string> {
  let code = generateReferralCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await findUserByReferralCode(code);
    if (!clash) break;
    code = generateReferralCode();
  }
  return code;
}

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
  let tempPassword: string | null = null;

  if (userId) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, referralCode: true } });
    if (!existing) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    targetUserId = existing.id;

    // Single source of truth for the referral link: generate it now only if
    // this user has never had one, so it's stable from this point forward —
    // never a second/parallel code, never regenerated once it exists.
    let referralCode = existing.referralCode;
    if (!referralCode) referralCode = await uniqueReferralCode();

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
    tempPassword = generateTempPassword(name.trim(), now);
    const referralCode = await uniqueReferralCode();

    const created = await createUser({
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      passwordHash: await hashPassword(tempPassword),
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
    tempPassword, // only ever present for a newly-created user — never returned/regenerated for an existing one
    trialEndsAt,
  });
}
