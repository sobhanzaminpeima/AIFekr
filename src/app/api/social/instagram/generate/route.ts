export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateIgContent } from "@/lib/instagram";
import { getSocialContentPack } from "@/lib/industry";
import type { Lang } from "@/lib/i18n";

// Structured counterpart to /api/social/generate — that one streams free
// -form markdown; this returns strict JSON (caption, exactly 5 hashtags,
// best posting time) so it can be scheduled/auto-published without the
// user having to copy-paste pieces out of prose.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { businessName, businessType, topic, language, model, propertyId } = await req.json();
  // German is a supported UI language, so it must survive this narrowing --
  // it used to collapse to "fa", which meant German users got Persian captions.
  const lang: Lang = language === "en" || language === "de" ? language : "fa";

  // Real-estate content pack — only ever engages when the caller explicitly
  // passes a propertyId they own (see src/lib/industry/realEstate/socialContentPack.ts).
  // Every other business keeps calling this route exactly as before; this
  // branch is a no-op for them since they never send a propertyId.
  if (propertyId) {
    const pack = getSocialContentPack("real-estate");
    const packResult = pack ? await pack.buildInstagramPost(user.id, String(propertyId), lang) : null;
    if (packResult) return NextResponse.json(packResult);
    // Falls through to the generic flow below if the pack couldn't produce
    // a result (foreign/missing property, generation failure) — never a
    // hard error just because the specialized path didn't pan out.
  }

  if (!businessName || !businessType) {
    return NextResponse.json({ error: "نام و نوع کسب‌وکار الزامی است" }, { status: 400 });
  }

  try {
    const result = await generateIgContent(businessName, businessType, topic || "", lang, model);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }
}
