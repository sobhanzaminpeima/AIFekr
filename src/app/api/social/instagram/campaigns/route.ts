export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAutoPublish } from "@/lib/utils/planGates";
import { normalizeLinks } from "@/lib/utils/campaignLinks";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const campaigns = await prisma.instagramCommentCampaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!canAutoPublish(user.plan)) {
    return NextResponse.json({ error: "این قابلیت فقط برای پلن‌های پرو و تیم فعال است" }, { status: 403 });
  }

  const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "اینستاگرام متصل نیست" }, { status: 400 });

  const { keyword, dmMessage, publicReplyMessage, postId, links, followGateEnabled, followGatePrompt } = await req.json().catch(() => ({}));
  if (!keyword?.trim() || !dmMessage?.trim()) {
    return NextResponse.json({ error: "کلمه کلیدی و پیام دایرکت الزامی است" }, { status: 400 });
  }

  const campaign = await prisma.instagramCommentCampaign.create({
    data: {
      userId: user.id,
      keyword: String(keyword).trim(),
      dmMessage: String(dmMessage).trim(),
      publicReplyMessage: publicReplyMessage?.trim() || null,
      postId: postId?.trim() || null,
      links: normalizeLinks(links),
      followGateEnabled: !!followGateEnabled,
      followGatePrompt: followGatePrompt?.trim() || null,
    },
  });
  return NextResponse.json({ campaign });
}
