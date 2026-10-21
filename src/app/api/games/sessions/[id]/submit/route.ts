export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";

// POST /api/games/sessions/:id/submit — submit answers, get server-validated score
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: { include: { questions: true } } },
  });

  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "جلسه یافت نشد" }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "این جلسه پایان یافته است" }, { status: 400 });
  }

  const { answers, durationMs } = await req.json();
  // answers: { [questionId]: selectedOptionId }

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "پاسخ‌ها نامعتبر هستند" }, { status: 400 });
  }

  // Server-side scoring — never trust client score
  let score = 0;
  const breakdown: any[] = [];
  for (const q of session.game.questions) {
    const chosen = answers[q.id];
    const correct = chosen === q.correctOption;
    if (correct) score += q.points;
    breakdown.push({ questionId: q.id, correct, points: correct ? q.points : 0 });
  }

  // Anti-cheat: min duration check (< 1s per question = bot)
  const minMs = session.game.questions.length * 1000;
  if (typeof durationMs === "number" && durationMs < minMs) {
    return NextResponse.json({ error: "ارسال پاسخ خیلی سریع است" }, { status: 429 });
  }

  // Integrity hash stored for audit
  const hash = createHash("sha256")
    .update(JSON.stringify({ sessionId: session.id, answers, score }))
    .digest("hex");

  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      score,
      completedAt: new Date(),
      metadata: JSON.stringify({ breakdown, durationMs, hash }),
    },
  });

  return NextResponse.json({
    score,
    maxScore: session.maxScore,
    percentage: session.maxScore > 0 ? Math.round((score / session.maxScore) * 100) : 0,
    breakdown,
  });
}
