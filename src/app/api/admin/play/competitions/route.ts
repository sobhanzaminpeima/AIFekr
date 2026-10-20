export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { competitionCommand } from "@/lib/play/competitions";
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  return NextResponse.json({
    tournaments: await prisma.playTournament.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { entries: true } } },
    }),
    rewards: await prisma.playRewardGrant.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  });
}
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    return NextResponse.json({
      result: await competitionCommand(admin.id, await req.json()),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "INVALID_COMMAND" },
      { status: 400 },
    );
  }
}
