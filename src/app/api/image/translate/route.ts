export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { translatePrompt } from "@/lib/ai/claude";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "متن خالی است" }, { status: 400 });

  const translated = await translatePrompt(text);
  return NextResponse.json({ translated });
}
