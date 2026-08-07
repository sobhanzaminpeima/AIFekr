export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { routedStreamChat } from "@/lib/ai/router";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "متن خالی است" }, { status: 400 });

  let translated = "";
  try {
    await routedStreamChat(
      [{ role: "user", content: `Translate this Persian text to English for an AI image generation prompt. Return ONLY the translated prompt, nothing else:\n\n${text}` }],
      "You are a translation engine. Output only the translated text, nothing else.",
      (chunk) => { translated += chunk; },
      () => {}
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ترجمه: ${msg}` }, { status: 502 });
  }

  if (!translated.trim()) {
    return NextResponse.json({ error: "خطا در ترجمه" }, { status: 502 });
  }

  return NextResponse.json({ translated: translated.trim() });
}
