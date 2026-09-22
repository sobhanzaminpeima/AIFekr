export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAutoPublish } from "@/lib/utils/planGates";
import { scoreContent } from "@/lib/social/contentQuality";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const { caption, hashtags, imageUrl, videoUrl, scheduledFor, mode } = await req.json();
  if (!caption || !scheduledFor) {
    return NextResponse.json({ error: "کپشن و زمان انتشار الزامی است" }, { status: 400 });
  }

  const requestedMode = mode === "auto" ? "auto" : "manual";
  if (requestedMode === "auto" && !canAutoPublish(user.plan)) {
    return NextResponse.json({ error: "انتشار خودکار فقط برای پلن حرفه‌ای و تیمی فعال است — لطفاً پلن خود را ارتقا دهید یا حالت دستی را انتخاب کنید" }, { status: 403 });
  }
  if (requestedMode === "auto") {
    const conn = await prisma.instagramConnection.findFirst({ where: { userId: user.id, ...bizScope(businessId) } });
    if (!conn) return NextResponse.json({ error: "ابتدا حساب اینستاگرام خود را متصل کنید" }, { status: 400 });
    if (!imageUrl && !videoUrl) return NextResponse.json({ error: "برای انتشار خودکار، تصویر یا ویدیوی پست الزامی است" }, { status: 400 });
  }

  // Freeze the quality score at scheduling time so it can later be compared
  // against the post's real reach/engagement and the rules tuned against this
  // account's own history rather than generic advice.
  const quality = scoreContent({
    caption,
    hashtags: Array.isArray(hashtags) ? hashtags : String(hashtags || "").split(/\s+/).filter(Boolean),
    format: videoUrl ? "REELS" : "IMAGE",
  });

  const post = await prisma.scheduledPost.create({
    data: {
      userId: user.id,
      businessId,
      caption,
      hashtags: Array.isArray(hashtags) ? hashtags.join(" ") : (hashtags || ""),
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      scheduledFor: new Date(scheduledFor),
      mode: requestedMode,
      qualityScore: quality.score,
      qualityNotes: quality.findings.length ? JSON.stringify(quality.findings.map((f) => f.code)) : null,
    },
  });

  return NextResponse.json({ post });
}
