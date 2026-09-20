export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getRankings, syncRankings } from "@/lib/seo/rankService";
import { gscMsg } from "@/lib/seo/gscMessages";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Real Search Console ranking data for a tracked site: latest window, change since the previous one, and opportunities. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const connected = !!(await prisma.gscConnection.findUnique({ where: { userId: user.id }, select: { id: true } }));
  return NextResponse.json({ connected, ...(await getRankings(site.id)) });
}

/** Sync now. Cheap (one Search Console query), but not something to hammer: one per 10 minutes per site. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();
  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const last = await prisma.seoRankSnapshot.findFirst({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < 10 * 60 * 1000) {
    return NextResponse.json({ error: tri(lang, "داده‌ها همین چند دقیقه پیش به‌روز شده‌اند.", "The data was refreshed a few minutes ago.", "Die Daten wurden vor wenigen Minuten aktualisiert.", "Veriler birkaç dakika önce güncellendi."), code: "COOLDOWN" }, { status: 429 });
  }

  const res = await syncRankings(site.id);
  if (!res.ok) {
    const message =
      res.reason === "not_connected" ? gscMsg(lang, "notConnected")
      : res.reason === "site_not_in_gsc" ? tri(lang, "این وب‌سایت در Search Console حساب گوگل شما ثبت/تأیید نشده است.", "This website isn't added and verified in your Google Search Console account.", "Diese Website ist in Ihrem Google-Search-Console-Konto nicht eingetragen/verifiziert.", "Bu web sitesi Google Search Console hesabınızda ekli/doğrulanmış değil.")
      : res.reason === "api_unavailable" ? gscMsg(lang, "unavailable")
      : res.reason === "reconnect_required" ? gscMsg(lang, "reconnect")
      : gscMsg(lang, "generic");
    return NextResponse.json({ error: message, reason: res.reason }, { status: res.reason === "not_connected" ? 400 : 502 });
  }
  return NextResponse.json({ ok: true, ...(await getRankings(site.id)), connected: true });
}
