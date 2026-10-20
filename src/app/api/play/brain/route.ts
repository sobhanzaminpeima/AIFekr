export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { brainAction } from "@/lib/play/brain";
import { z } from "zod";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
  const u = await requireAuth(req);
  if (!u) return unauthorizedResponse(req);
  if (!rateLimit(`play:brain:${u.id}`, 60, 60000).allowed)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const b = z
      .object({
        id: z.string().max(100),
        index: z.number().int().min(0).max(4).optional(),
        answer: z.number().int().min(0).max(3).optional(),
      })
      .strict()
      .parse(await req.json());
    return NextResponse.json(await brainAction(u.id, b.id, b.index, b.answer));
  } catch {
    return NextResponse.json({ error: "ANSWER_NOT_ACCEPTED" }, { status: 400 });
  }
}
