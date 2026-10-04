export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { scheduleFlashcardReview, type FlashcardRating } from "@/lib/student/spacedRepetition";

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { rating?: FlashcardRating };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body.rating || !["hard", "good", "easy"].includes(body.rating)) return NextResponse.json({ error: "درجهٔ مرور معتبر نیست" }, { status: 400 });
  const flashcard = await prisma.studentFlashcard.findFirst({ where: { id: context.params.id, userId: user.id }, select: { id: true, masteryLevel: true, reviewCount: true } });
  if (!flashcard) return NextResponse.json({ error: "فلش‌کارت پیدا نشد" }, { status: 404 });
  const now = new Date();
  const schedule = scheduleFlashcardReview(flashcard.masteryLevel, body.rating, now);
  await prisma.studentFlashcard.updateMany({ where: { id: flashcard.id, userId: user.id }, data: { masteryLevel: schedule.masteryLevel, reviewCount: { increment: 1 }, lastReviewedAt: now, nextReviewAt: schedule.nextReviewAt } });
  return NextResponse.json({ masteryLevel: schedule.masteryLevel, reviewCount: flashcard.reviewCount + 1, nextReviewAt: schedule.nextReviewAt });
}
