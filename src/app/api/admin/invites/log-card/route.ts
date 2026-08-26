export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_LANGS = ["fa", "en", "de"];

/**
 * Called once the admin actually downloads an invite card PNG (phase 4) —
 * records the InviteCard row (phase 1's model, first real use of it) and
 * an AuditLog entry. Never stores a password or a referral code of its
 * own; inviteText is the rendered message shown on the card, for audit
 * purposes only.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { userId, language, inviteText } = await req.json().catch(() => ({}));
  if (!userId || !VALID_LANGS.includes(language) || typeof inviteText !== "string") {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  await prisma.inviteCard.create({
    data: { userId, language, inviteText, generatedBy: admin.id },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "invite_card_generated", targetId: userId, metadata: JSON.stringify({ language }) },
  });

  return NextResponse.json({ ok: true });
}
