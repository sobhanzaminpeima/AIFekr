export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateIgContent } from "@/lib/instagram";

// Structured counterpart to /api/social/generate — that one streams free
// -form markdown; this returns strict JSON (caption, exactly 5 hashtags,
// best posting time) so it can be scheduled/auto-published without the
// user having to copy-paste pieces out of prose.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { businessName, businessType, topic, language, model } = await req.json();
  if (!businessName || !businessType) {
    return NextResponse.json({ error: "نام و نوع کسب‌وکار الزامی است" }, { status: 400 });
  }
  const lang = language === "en" ? "en" : "fa";

  try {
    const result = await generateIgContent(businessName, businessType, topic || "", lang, model);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }
}
