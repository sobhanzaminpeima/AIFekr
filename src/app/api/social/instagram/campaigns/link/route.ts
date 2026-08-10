export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface CampaignLink { id: string; label: string; url: string; clicks: number }

// Tracked short link sent inside campaign DMs — increments the click counter
// for that specific link, then redirects the visitor to the real URL.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("c");
  const linkId = searchParams.get("l");
  if (!campaignId || !linkId) return NextResponse.redirect(appUrl);

  const campaign = await prisma.instagramCommentCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.links) return NextResponse.redirect(appUrl);

  let links: CampaignLink[] = [];
  try {
    links = JSON.parse(campaign.links);
  } catch {
    return NextResponse.redirect(appUrl);
  }

  const link = links.find((l) => l.id === linkId);
  if (!link) return NextResponse.redirect(appUrl);

  const updated = links.map((l) => (l.id === linkId ? { ...l, clicks: (l.clicks || 0) + 1 } : l));
  await prisma.instagramCommentCampaign.update({
    where: { id: campaignId },
    data: { links: JSON.stringify(updated) },
  }).catch(() => {});

  return NextResponse.redirect(link.url);
}
