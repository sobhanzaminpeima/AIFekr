export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { getSeoProviderConfig, publicSeoConfig, saveSeoProviderConfig } from "@/lib/seo/intelligence/config";
import { prisma } from "@/lib/db/prisma";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return unauthorizedResponse(req);
  const [jobs, config] = await Promise.all([
    prisma.seoResearchJob.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, userId: true, action: true, status: true, credits: true, estimatedCostUsd: true, actualCostUsd: true, errorCode: true, createdAt: true, refundedAt: true, notificationSentAt:true, notificationAttempts:true, notificationError:true } }),
    getSeoProviderConfig(),
  ]);
  return NextResponse.json({ config: publicSeoConfig(config), jobs });
}
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req); if (!admin) return unauthorizedResponse(req);
  try { const config = await saveSeoProviderConfig(await req.json()); await prisma.auditLog.create({ data: { actorId: admin.id, action: "seo_provider_configuration", metadata: JSON.stringify({ enabled: config.enabled, configured: config.configured, markupPercent: config.markupPercent, dailyCredits: config.dailyCredits }) } }); return NextResponse.json({ config }); }
  catch { return NextResponse.json({ code: "INVALID_PROVIDER_CONFIGURATION" }, { status: 400 }); }
}
