export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { prisma } from "@/lib/db/prisma";
import { auditAndSave } from "@/lib/seo/siteAuditService";
import { syncRankings } from "@/lib/seo/rankService";
import { GSC_ENABLED } from "@/lib/seo/features";

/** Sites audited per invocation: each audit crawls up to 10 pages, so the run is kept short and frequent. */
const BATCH = 4;
/** Search Console snapshots taken per invocation. */
const RANK_SYNCS_PER_TICK = 5;



/**
 * Re-audits every site whose schedule is due (autoAudit + nextAuditAt <= now).
 * Hit by the system crontab (e.g. hourly). Every completed/failed audit queues
 * an in-app notification and durable email through auditAndSave.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const due = await prisma.seoSite.findMany({
    where: { autoAudit: true, nextAuditAt: { lte: new Date() }, user: { isBlocked: false } },
    orderBy: { nextAuditAt: "asc" },
    take: BATCH,
    include: { user: { select: { email: true, name: true, language: true } } },
  });

  const results: { siteId: string; ok: boolean; score?: number; emailed?: boolean; reason?: string }[] = [];
  for (const site of due) {
    const lang = (["fa", "en", "de", "tr"] as const).find((l) => l === site.user.language) ?? "fa";
    try {
      const run = await auditAndSave(site.id, "auto", lang);
      if (!run.ok) { results.push({ siteId: site.id, ok: false, reason: run.failure.reason }); continue; }

      const emailed = false; // Delivery is handled by the durable notification queue.
      results.push({ siteId: site.id, ok: true, score: run.score, emailed });
    } catch (e) {
      console.error("seo-audits: audit failed:", e);
      // Push the schedule out so a persistently failing site cannot starve the queue.
      await prisma.seoSite.update({ where: { id: site.id }, data: { nextAuditAt: new Date(Date.now() + 6 * 60 * 60 * 1000) } }).catch(() => {});
      results.push({ siteId: site.id, ok: false, reason: "error" });
    }
  }
  // Weekly Search Console snapshots ride on this same tick (no extra crontab entry): a few sites per run,
  // only those with a Google connection whose newest snapshot is older than six days.
  const ranks: { siteId: string; ok: boolean; reason?: string }[] = [];
  const candidates = !GSC_ENABLED ? [] : await prisma.seoSite.findMany({ where: { user: { gscConnection: { isNot: null }, isBlocked: false } }, orderBy: { createdAt: "asc" }, take: 40, select: { id: true } });
  for (const c of candidates) {
    if (ranks.length >= RANK_SYNCS_PER_TICK) break;
    const last = await prisma.seoRankSnapshot.findFirst({ where: { siteId: c.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (last && Date.now() - last.createdAt.getTime() < 6 * 24 * 60 * 60 * 1000) continue;
    const r = await syncRankings(c.id);
    ranks.push({ siteId: c.id, ok: r.ok, reason: r.ok ? undefined : r.reason });
  }

  return NextResponse.json({ ran: due.length, results, ranks });
}
