export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conn = await prisma.seoConnection.findUnique({ where: { userId: user.id } });
  // Never send the app password back to the client
  return NextResponse.json({
    connection: conn ? { platform: conn.platform, siteUrl: conn.siteUrl, wpUsername: conn.wpUsername, hasAppPassword: !!conn.wpAppPassword } : null,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { platform, siteUrl, wpUsername, wpAppPassword } = await req.json();
  if (!["wordpress", "aifekr", "other"].includes(platform)) {
    return NextResponse.json({ error: "پلتفرم نامعتبر" }, { status: 400 });
  }
  if (platform === "wordpress" && (!siteUrl || !wpUsername || !wpAppPassword)) {
    return NextResponse.json({ error: "آدرس سایت، نام کاربری و Application Password الزامی است" }, { status: 400 });
  }

  const conn = await prisma.seoConnection.upsert({
    where: { userId: user.id },
    update: { platform, siteUrl: siteUrl || null, wpUsername: wpUsername || null, wpAppPassword: wpAppPassword || null },
    create: { userId: user.id, platform, siteUrl: siteUrl || null, wpUsername: wpUsername || null, wpAppPassword: wpAppPassword || null },
  });

  return NextResponse.json({ connection: { platform: conn.platform, siteUrl: conn.siteUrl, wpUsername: conn.wpUsername, hasAppPassword: !!conn.wpAppPassword } });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  await prisma.seoConnection.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true });
}
