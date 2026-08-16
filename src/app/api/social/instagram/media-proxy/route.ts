export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Streams an Instagram media/thumbnail URL through our own server instead of
 * pointing the browser straight at Meta's signed scontent-*.cdninstagram.com
 * URL — those routinely fail to load cross-origin (referrer/hotlink
 * restrictions) when embedded directly in a third-party `<img src>`, even
 * though the same URL works fine fetched server-side. Requires the caller to
 * be authenticated and own an Instagram connection, so this can't be used as
 * an open image-fetching proxy.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url الزامی است" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "url نامعتبر است" }, { status: 400 });
  }
  // Only ever proxy Meta's own CDN — never an arbitrary attacker-supplied host (SSRF guard).
  if (!/(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/.test(parsed.hostname)) {
    return NextResponse.json({ error: "دامنه غیرمجاز" }, { status: 400 });
  }

  const conn = await prisma.instagramConnection.findFirst({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "به اینستاگرام متصل نیستید" }, { status: 400 });

  const upstream = await fetch(parsed.toString(), { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "دریافت تصویر ناموفق بود" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
