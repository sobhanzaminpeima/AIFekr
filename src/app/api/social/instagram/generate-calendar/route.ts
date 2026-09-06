export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateWeeklyCalendar } from "@/lib/instagram";
import type { Lang } from "@/lib/i18n";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { businessName, businessType, topic, language } = await req.json();
  if (!businessName || !businessType) {
    return NextResponse.json({ error: "نام و نوع کسب‌وکار الزامی است" }, { status: 400 });
  }
  // Keep German -- narrowing it to "fa" here was why German users got a
  // Persian content calendar.
  const lang: Lang = language === "en" || language === "de" ? language : "fa";

  try {
    const posts = await generateWeeklyCalendar(businessName, businessType, topic || "", lang);
    return NextResponse.json({ posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }
}
