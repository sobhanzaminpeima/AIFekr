export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { parseSnapshot } from "@/lib/seo/siteAuditService";
import { diffAudits } from "@/lib/seo/siteAuditCore";

/** One saved audit in full, with what changed since the audit before it. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const audit = await prisma.seoAudit.findFirst({ where: { id: params.id, userId: user.id }, include: { site: { select: { id: true, url: true, name: true } } } });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const previous = await prisma.seoAudit.findFirst({ where: { siteId: audit.siteId, createdAt: { lt: audit.createdAt } }, orderBy: { createdAt: "desc" } });
  const snapshot = parseSnapshot(audit);
  const diff = previous ? diffAudits(parseSnapshot(previous), snapshot) : null;

  let plan: unknown = null;
  try { plan = audit.plan ? JSON.parse(audit.plan) : null; } catch { plan = null; }

  return NextResponse.json({
    audit: { id: audit.id, score: audit.score, pagesCrawled: audit.pagesCrawled, failCount: audit.failCount, warnCount: audit.warnCount, passCount: audit.passCount, source: audit.source, createdAt: audit.createdAt, planCreatedAt: audit.planCreatedAt },
    site: audit.site,
    pages: snapshot.pages,
    siteIssues: snapshot.siteIssues,
    diff,
    plan,
  });
}
