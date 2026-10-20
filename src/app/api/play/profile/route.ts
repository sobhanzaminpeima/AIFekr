export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { playAccess } from "@/lib/play/service";
import { z } from "zod";
export async function POST(req: NextRequest) {
  const u = await requireAuth(req);
  if (!u) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    await playAccess(u.id);
    const b = z
      .object({ publicName: z.boolean() })
      .strict()
      .parse(await req.json());
    await prisma.playProfile.upsert({
      where: { userId: u.id },
      create: { userId: u.id, ...b },
      update: b,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "PROFILE_NOT_SAVED" }, { status: 400 });
  }
}
