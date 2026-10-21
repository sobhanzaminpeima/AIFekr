export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateWeeklyCalendar } from "@/lib/instagram";
import { getBrandProfile, brandProfileToPrompt } from "@/lib/social/brandProfile";
import type { Lang } from "@/lib/i18n";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { businessName, businessType, topic, language } = await req.json();

  // Saved positioning read server-side; also backfills name/type.
  const profile = await getBrandProfile(user.id).catch(() => null);
  const name = businessName || profile?.businessName;
  const type = businessType || profile?.pageType || profile?.businessIndustry;

  if (!name || !type) {
    return NextResponse.json({ error: "نام و نوع کسب‌وکار الزامی است" }, { status: 400 });
  }
  // Keep German -- narrowing it to "fa" here was why German users got a
  // Persian content calendar.
  const lang: Lang = language === "en" || language === "de" ? language : "fa";

  try {
    const posts = await generateWeeklyCalendar(name, type, topic || "", lang, brandProfileToPrompt(profile));
    return NextResponse.json({ posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }
}
