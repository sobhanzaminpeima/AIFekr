export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

// POST /api/games/sessions — start a new game session
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { gameId } = await req.json();
  const game = await prisma.game.findUnique({
    where: { id: gameId, isActive: true },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!game) return NextResponse.json({ error: "بازی یافت نشد" }, { status: 404 });

  const maxScore = game.questions.reduce((s, q) => s + q.points, 0);

  const session = await prisma.gameSession.create({
    data: { userId: user.id, gameId, maxScore, status: "active" },
  });

  // Return questions WITHOUT correct answers
  const questions = game.questions.map((q) => ({
    id: q.id,
    text: q.text,
    textEn: q.textEn,
    options: JSON.parse(q.options),
    points: q.points,
    difficulty: q.difficulty,
  }));

  return NextResponse.json({ sessionId: session.id, questions, durationSec: game.durationSec });
}
