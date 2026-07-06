export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAutoPublish } from "@/lib/utils/planGates";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { caption, hashtags, imageUrl, scheduledFor, mode } = await req.json();
  if (!caption || !scheduledFor) {
    return NextResponse.json({ error: "کپشن و زمان انتشار الزامی است" }, { status: 400 });
  }

  const requestedMode = mode === "auto" ? "auto" : "manual";
  if (requestedMode === "auto" && !canAutoPublish(user.plan)) {
    return NextResponse.json({ error: "انتشار خودکار فقط برای پلن حرفه‌ای و تیمی فعال است — لطفاً پلن خود را ارتقا دهید یا حالت دستی را انتخاب کنید" }, { status: 403 });
  }
  if (requestedMode === "auto") {
    const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
    if (!conn) return NextResponse.json({ error: "ابتدا حساب اینستاگرام خود را متصل کنید" }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ error: "برای انتشار خودکار، تصویر پست الزامی است" }, { status: 400 });
  }

  const post = await prisma.scheduledPost.create({
    data: {
      userId: user.id,
      caption,
      hashtags: Array.isArray(hashtags) ? hashtags.join(" ") : (hashtags || ""),
      imageUrl: imageUrl || null,
      scheduledFor: new Date(scheduledFor),
      mode: requestedMode,
    },
  });

  return NextResponse.json({ post });
}
