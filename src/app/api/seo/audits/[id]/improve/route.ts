export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { crawlUrlDetailed, auditUrlPage } from "@/lib/seo/urlAudit";
import { crawlFailureMessage } from "@/lib/seo/crawlMessages";
import { generateImprovePlan } from "@/lib/seo/improvePlan";
import { normalizePageUrl } from "@/lib/seo/siteAuditCore";
import { parseSnapshot } from "@/lib/seo/siteAuditService";
import { withToolCredits } from "@/lib/utils/withToolCredits";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * AI improvement plan for a saved audit, stored on the audit so it can be
 * reopened later and compared with the next audit. The page it is based on is
 * re-crawled now (defaults to the homepage; any page of the site may be chosen),
 * so the advice reflects the live page, not last week's snapshot.
 */
async function handlePost(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const audit = await prisma.seoAudit.findFirst({ where: { id: params.id, userId: user.id }, include: { site: true } });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // Only pages of this site: never let the request point the crawler somewhere else.
  const requested = typeof body.pageUrl === "string" ? normalizePageUrl(body.pageUrl, audit.site.url) : null;
  const pageUrl = requested ?? audit.site.url;

  const crawl = await crawlUrlDetailed(pageUrl);
  if (!("data" in crawl)) return NextResponse.json({ error: crawlFailureMessage(lang, crawl), reason: crawl.reason }, { status: 502 });
  const { score, groups } = auditUrlPage(crawl.data, pageUrl, lang);

  let plan;
  try {
    // The audit also crawled this page as a phone; carry those findings into the plan.
    const stored = parseSnapshot(audit).pages.find((pg) => pg.url.replace(/\/$/, "") === pageUrl.replace(/\/$/, ""));
    const mobileChecks = (stored?.issues ?? []).filter((i) => i.id.startsWith("mobile_"));
    plan = await generateImprovePlan({ url: pageUrl, data: crawl.data, groups, score, lang, extraChecks: mobileChecks, targetKeyword: typeof body.targetKeyword === "string" ? body.targetKeyword.trim().slice(0, 100) : undefined });
  } catch (e) {
    console.error("seo audit improve: model call failed:", e);
    plan = null;
  }
  if (!plan) {
    return NextResponse.json({ error: tri(lang, "هوش مصنوعی پاسخ قابل استفاده‌ای نداد. اعتبار شما برگشت داده شد؛ دوباره امتحان کنید.", "The AI didn't return a usable plan. Your credits were refunded; please try again.", "Die KI hat keinen brauchbaren Plan geliefert. Ihre Credits wurden erstattet; bitte erneut versuchen.", "Yapay zekâ kullanılabilir bir plan vermedi. Kredileriniz iade edildi; lütfen tekrar deneyin."), reason: "model_failed" }, { status: 502 });
  }

  await prisma.seoAudit.update({ where: { id: audit.id }, data: { plan: JSON.stringify({ ...plan, pageUrl }), planCreatedAt: new Date() } });
  return NextResponse.json({ plan: { ...plan, pageUrl } });
}

export const POST = withToolCredits("seo.improve", handlePost);
