export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { startSession, finishSession } from "@/lib/play/service";
import { gameSlugs } from "@/lib/play/engine";
import { rateLimit } from "@/lib/utils/rateLimit";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
const create = z
  .object({
    action: z.literal("start"),
    game: z.enum(gameSlugs),
    language: z.enum(["fa", "en", "de", "tr"]),
    tournamentId: z.string().max(100).optional(),
  })
  .strict();
const abandon = z
  .object({ action: z.literal("abandon"), id: z.string().min(1).max(100) })
  .strict();
const finish = z
  .object({
    action: z.literal("finish"),
    id: z.string().max(100),
    frames: z.number().int().min(1).max(12000),
    events: z
      .array(
        z
          .object({
            frame: z.number().int().positive(),
            input: z.enum(["left", "right", "up", "down", "tap"]),
          })
          .strict(),
      )
      .max(12000),
  })
  .strict();
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!rateLimit(`play:${user.id}`, 20, 60000).allowed)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const text = await req.text();
    if (text.length > 500000) throw Error("INPUT_TOO_LARGE");
    const body = z
      .discriminatedUnion("action", [create, finish, abandon])
      .parse(JSON.parse(text));
    if (body.action === "abandon") {
      await prisma.playSession.updateMany({
        where: { id: body.id, userId: user.id, status: "OPEN" },
        data: { status: "ABANDONED", completedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "start") {
      const session = await startSession(
        user.id,
        body.game,
        body.language,
        body.tournamentId,
      );
      return NextResponse.json({
        session: {
          id: session.id,
          seed: session.seed,
          configuration: JSON.parse(session.configuration),
          game: session.gameSlug,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
        },
      });
    }
    const result = await finishSession(
      user.id,
      body.id,
      body.events,
      body.frames,
    );
    return NextResponse.json({
      result: { score: result.score, xp: result.xp, status: result.status },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "INVALID_REQUEST" },
      { status: 400 },
    );
  }
}
