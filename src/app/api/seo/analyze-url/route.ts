export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { crawlUrl, auditUrlPage } from "@/lib/seo/urlAudit";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { url, language } = await req.json().catch(() => ({}));
  if (!url) return NextResponse.json({ error: "URL الزامی است" }, { status: 400 });
  const lang = language === "en" ? "en" : "fa";

  const data = await crawlUrl(url);
  if (!data) {
    return NextResponse.json({ error: lang === "fa" ? "خطا در بارگذاری URL" : "Failed to load URL" }, { status: 502 });
  }

  const { score, groups } = auditUrlPage(data, url, lang);
  return NextResponse.json({ score, groups, url });
}
