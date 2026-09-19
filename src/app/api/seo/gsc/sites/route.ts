export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getGscAccessToken, listGscSites, GscReconnectRequiredError, GscApiUnavailableError } from "@/lib/googleSearchConsole";
import { decryptSecret } from "@/lib/crypto/secretBox";
import { gscMsg } from "@/lib/seo/gscMessages";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: gscMsg(lang, "notConnected") }, { status: 400 });

  try {
    const accessToken = await getGscAccessToken(decryptSecret(conn.refreshToken));
    const sites = await listGscSites(accessToken);
    return NextResponse.json({ sites });
  } catch (e) {
    // 502/504 get intercepted by nginx's own error_page and replaced with a static
    // HTML page, hiding this message from the client — use a status nginx doesn't rewrite.
    console.error("GSC sites fetch failed:", e);
    if (e instanceof GscApiUnavailableError) {
      // Not the user's doing and not fixable by reconnecting: say so, and do NOT ask them to reconnect.
      return NextResponse.json({ error: gscMsg(lang, "unavailable"), code: "gsc_api_unavailable" }, { status: 503 });
    }
    if (e instanceof GscReconnectRequiredError) {
      return NextResponse.json(
        { error: gscMsg(lang, "reconnect"), reconnectRequired: true },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: gscMsg(lang, "generic") }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const { siteUrl } = await req.json().catch(() => ({}));
  if (!siteUrl) return NextResponse.json({ error: gscMsg(lang, "siteRequired") }, { status: 400 });

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: gscMsg(lang, "notConnected") }, { status: 400 });

  const updated = await prisma.gscConnection.update({ where: { userId: user.id }, data: { siteUrl } });
  return NextResponse.json({ siteUrl: updated.siteUrl });
}
