export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { auditAndSave } from "@/lib/seo/siteAuditService";
import { crawlFailureMessage } from "@/lib/seo/crawlMessages";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Minimum gap between manual audits of one site: an audit crawls up to 10 pages of someone else's server. */
const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

/** Runs an audit now and saves it (with the change since the previous audit). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (site.lastAuditAt && Date.now() - site.lastAuditAt.getTime() < MANUAL_COOLDOWN_MS) {
    const wait = Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - site.lastAuditAt.getTime())) / 1000);
    return NextResponse.json({ error: tri(lang, `لطفاً ${wait} ثانیه صبر کنید و دوباره تحلیل کنید.`, `Please wait ${wait}s before auditing again.`, `Bitte warten Sie ${wait} s, bevor Sie erneut prüfen.`, `Lütfen tekrar denetlemeden önce ${wait} sn bekleyin.`), code: "COOLDOWN" }, { status: 429 });
  }

  const run = await auditAndSave(site.id, "manual", lang);
  if (!run.ok) return NextResponse.json({ error: crawlFailureMessage(lang, run.failure), reason: run.failure.reason }, { status: 502 });
  return NextResponse.json({ auditId: run.auditId, score: run.score, diff: run.diff });
}
