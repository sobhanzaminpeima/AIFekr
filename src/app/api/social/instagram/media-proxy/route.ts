export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { fetch as undiciFetch, ProxyAgent } from "undici";

// A dedicated HTTP CONNECT tunnel on the relay VPS (tinyproxy, IP-restricted
// to this server) — a transparent tunnel, unlike the nginx path-based
// /cdn-proxy/ used for other providers, which had to reconstruct the target
// URL and ended up invalidating Meta's signed-URL hash in the process. A
// CONNECT tunnel never touches the URL/query string at all, so Meta's
// signature verification (which failed via the nginx approach) passes.
const MEDIA_TUNNEL = process.env.INSTAGRAM_MEDIA_PROXY_URL;
const mediaProxyAgent = MEDIA_TUNNEL ? new ProxyAgent(MEDIA_TUNNEL) : null;

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

  // This server's IP is blocked/times out connecting directly to Meta's CDN
  // (same reason other providers go through AI_RELAY_BASE_URL — see
  // src/lib/ai/providers.ts). Route through the CONNECT tunnel when
  // configured; fall back to a direct fetch otherwise (e.g. local dev).
  const fetchOpts: Parameters<typeof undiciFetch>[1] = { headers: { "User-Agent": "Mozilla/5.0" } };
  if (mediaProxyAgent) (fetchOpts as { dispatcher?: ProxyAgent }).dispatcher = mediaProxyAgent;

  const upstream = await undiciFetch(parsed.toString(), fetchOpts).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    if (upstream) {
      const body = await upstream.text().catch(() => "");
      console.error(`Instagram media-proxy upstream failed: status=${upstream.status} body=${body.slice(0, 200)}`);
    } else {
      console.error("Instagram media-proxy upstream fetch threw (network error)");
    }
    return NextResponse.json({ error: "دریافت تصویر ناموفق بود" }, { status: 502 });
  }

  return new NextResponse(upstream.body as unknown as BodyInit, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
