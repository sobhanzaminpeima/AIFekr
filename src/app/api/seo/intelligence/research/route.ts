export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { scopedSeoSite, SeoError } from "@/lib/seo/intelligence/scope";
import { seoRequestSchema } from "@/lib/seo/intelligence/provider";
import { getSeoProviderConfig, quoteSeoAction } from "@/lib/seo/intelligence/config";
import { queueSeoResearch } from "@/lib/seo/intelligence/jobs";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  try {
    const { site } = await scopedSeoSite(user.id, req.nextUrl.searchParams.get("siteId") || "");
    const jobs = await prisma.seoResearchJob.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, status: true, credits: true, result: true, input: true, errorCode: true, createdAt: true, completedAt: true, refundedAt: true } });
    return NextResponse.json({ jobs });
  } catch (error) { return NextResponse.json({ code: error instanceof SeoError ? error.code : "RESEARCH_UNAVAILABLE" }, { status: error instanceof SeoError ? error.status : 503 }); }
}
export async function POST(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  if (!rateLimit(`seo-research:${user.id}`, 15, 60000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
  try {
    const body = await req.json();
    const input = seoRequestSchema.parse(body.input);
    await scopedSeoSite(user.id, input.siteId, true);
    if (body.preview === true) { const quote = quoteSeoAction(await getSeoProviderConfig(), input.action, input.rows); return NextResponse.json({ quote: { credits: quote.credits, rows: quote.rows } }); }
    if (typeof body.confirmedCredits !== "number" || typeof body.idempotencyKey !== "string") throw new SeoError("CONFIRMATION_REQUIRED");
    const job = await queueSeoResearch(user.id, input, body.idempotencyKey, body.confirmedCredits);
    return NextResponse.json({ job: { id: job.id, status: job.status, credits: job.credits } }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ code: error instanceof SeoError ? error.code : error instanceof Error && ["PROVIDER_NOT_CONFIGURED", "PRICING_NOT_CONFIGURED", "UNSUPPORTED_SEARCH_MARKET", "MARKETS_UNAVAILABLE"].includes(error.message) ? error.message : "INVALID_RESEARCH_REQUEST" }, { status: error instanceof SeoError ? error.status : 400 });
  }
}
