import { prisma } from "@/lib/db/prisma";
import { runSiteAudit } from "@/lib/seo/siteAudit";
import { diffAudits, isNotable, nextAuditDate, type AuditDiff, type AuditSnapshot, type StoredIssue, type StoredPage } from "@/lib/seo/siteAuditCore";
import type { CrawlFailure } from "@/lib/seo/urlAudit";

/** Sites a user may track, by plan. */
const SITE_LIMITS: Record<string, number> = { FREE: 1, ECHO: 3, PLUS: 5, PRO: 10, ALPHA: 25 };
export const siteLimitFor = (plan: string | null | undefined): number => SITE_LIMITS[plan || "FREE"] ?? 3;

const KEEP_AUDITS_PER_SITE = 100;

export function parseSnapshot(a: { score: number; pages: string; siteChecks: string }): AuditSnapshot {
  let pages: StoredPage[] = [];
  let siteIssues: StoredIssue[] = [];
  try { pages = JSON.parse(a.pages); } catch { /* corrupt row: treat as empty rather than fail the page */ }
  try { siteIssues = JSON.parse(a.siteChecks); } catch { /* same */ }
  return { score: a.score, pages, siteIssues };
}

export type AuditRun =
  | { ok: true; auditId: string; score: number; diff: AuditDiff | null; notable: boolean }
  | { ok: false; failure: CrawlFailure };

/**
 * Runs an audit of a saved site and stores it. Scheduled and manual runs share
 * this path so history, the diff against the previous audit and the site's
 * "next audit" date are always updated the same way.
 */
export async function auditAndSave(siteId: string, source: "manual" | "auto", lang: "fa" | "en" | "de" | "tr"): Promise<AuditRun> {
  const site = await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } });
  const outcome = await runSiteAudit(site.url, lang);

  const now = new Date();
  if (!outcome.ok) {
    // Keep the schedule moving even when the site is down, so a dead site is not retried every cron tick.
    if (site.autoAudit) await prisma.seoSite.update({ where: { id: site.id }, data: { nextAuditAt: nextAuditDate(site.frequency, now) } });
    return { ok: false, failure: outcome.failure };
  }
  const r = outcome.result;

  const previous = await prisma.seoAudit.findFirst({ where: { siteId }, orderBy: { createdAt: "desc" } });
  const curr: AuditSnapshot = { score: r.score, pages: r.pages, siteIssues: r.siteIssues };
  const diff = previous ? diffAudits(parseSnapshot(previous), curr) : null;

  const audit = await prisma.seoAudit.create({
    data: {
      siteId, userId: site.userId, source, score: r.score, pagesCrawled: r.pagesCrawled,
      failCount: r.failCount, warnCount: r.warnCount, passCount: r.passCount,
      siteChecks: JSON.stringify(r.siteIssues), pages: JSON.stringify(r.pages),
    },
  });

  await prisma.seoSite.update({
    where: { id: siteId },
    data: { lastAuditAt: now, lastScore: r.score, nextAuditAt: site.autoAudit ? nextAuditDate(site.frequency, now) : null },
  });

  // History is for trends, not an archive: keep the newest N.
  const old = await prisma.seoAudit.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, skip: KEEP_AUDITS_PER_SITE, select: { id: true } });
  if (old.length) await prisma.seoAudit.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });

  return { ok: true, auditId: audit.id, score: r.score, diff, notable: diff ? isNotable(diff) : false };
}
