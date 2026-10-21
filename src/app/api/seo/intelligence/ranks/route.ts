export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { scopedSeoSite, SeoError } from "@/lib/seo/intelligence/scope";
import { rankObservation, csvCell } from "@/lib/seo/intelligence/rankHistory";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  try {
    const { site } = await scopedSeoSite(user.id, req.nextUrl.searchParams.get("siteId") || "");
    const jobs = await prisma.seoResearchJob.findMany({ where: { siteId: site.id, action: "rank", status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, input: true, result: true, createdAt: true, completedAt: true } });
    const observations = jobs.map(job => rankObservation(job, new URL(site.url).hostname)).filter(row => row !== null);
    if (req.nextUrl.searchParams.get("format") === "csv") {
      const rows = [["Keyword", "Country code", "Language", "Device", "Observed position", "Checked at", "Checked depth"].map(csvCell).join(","), ...observations.map(row => [row.keyword, row.locationCode, row.languageCode, row.device, row.position, row.checkedAt, row.depth].map(csvCell).join(","))];
      return new NextResponse("\uFEFF" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="aifekr-rank-history.csv"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return NextResponse.json({ observations, limit: 200 });
  } catch (error) { return NextResponse.json({ code: error instanceof SeoError ? error.code : "RANK_HISTORY_UNAVAILABLE" }, { status: error instanceof SeoError ? error.status : 503 }); }
}
