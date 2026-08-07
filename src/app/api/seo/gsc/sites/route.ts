export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getGscAccessToken, listGscSites } from "@/lib/googleSearchConsole";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "به Search Console متصل نیستید" }, { status: 400 });

  try {
    const accessToken = await getGscAccessToken(conn.refreshToken);
    const sites = await listGscSites(accessToken);
    return NextResponse.json({ sites });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { siteUrl } = await req.json().catch(() => ({}));
  if (!siteUrl) return NextResponse.json({ error: "siteUrl الزامی است" }, { status: 400 });

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "به Search Console متصل نیستید" }, { status: 400 });

  const updated = await prisma.gscConnection.update({ where: { userId: user.id }, data: { siteUrl } });
  return NextResponse.json({ siteUrl: updated.siteUrl });
}
