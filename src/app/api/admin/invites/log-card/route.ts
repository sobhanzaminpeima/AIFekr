export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

const VALID_LANGS = ["fa", "en", "de"];

/**
 * Called once the admin actually downloads an invite card PNG (phase 4) —
 * uploads the rendered PNG to R2 storage (so an admin can revisit a past
 * card without regenerating it) and records the InviteCard row + an
 * AuditLog entry. Never stores a password or a referral code of its own;
 * inviteText is the rendered message shown on the card, for audit
 * purposes only.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { userId, language, inviteText, imageDataUrl } = await req.json().catch(() => ({}));
  if (!userId || !VALID_LANGS.includes(language) || typeof inviteText !== "string") {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  let imageUrl: string | undefined;
  if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/png;base64,")) {
    try {
      const buf = Buffer.from(imageDataUrl.split(",")[1] || "", "base64");
      const key = getStorageKey(userId, "invite-card", `${language}.png`);
      imageUrl = await uploadToStorage(buf, key, "image/png");
    } catch (err) {
      console.error("invite card image upload failed:", err);
      // Non-fatal — the card was still downloaded locally by the admin; we
      // just won't have a re-viewable copy for this one.
    }
  }

  await prisma.inviteCard.create({
    data: { userId, language, inviteText, imageUrl, generatedBy: admin.id },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "invite_card_generated", targetId: userId, metadata: JSON.stringify({ language }) },
  });

  return NextResponse.json({ ok: true, imageUrl });
}

/** Lists previously saved invite cards for one user, newest first — lets the admin revisit a card without regenerating it. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });

  const cards = await prisma.inviteCard.findMany({
    where: { userId, imageUrl: { not: null } },
    select: { id: true, language: true, imageUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ cards });
}
