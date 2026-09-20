export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { prisma } from "@/lib/db/prisma";
import { auditAndSave } from "@/lib/seo/siteAuditService";
import { sendEmail } from "@/lib/email/resend";
import { tri } from "@/lib/i18n/tri";

/** Sites audited per invocation: each audit crawls up to 10 pages, so the run is kept short and frequent. */
const BATCH = 4;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/**
 * Re-audits every site whose schedule is due (autoAudit + nextAuditAt <= now).
 * Hit by the system crontab (e.g. hourly). A user is emailed only when the audit
 * found something worth reading: a score drop of 5+ points or a new hard failure.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const due = await prisma.seoSite.findMany({
    where: { autoAudit: true, nextAuditAt: { lte: new Date() }, user: { isBlocked: false } },
    orderBy: { nextAuditAt: "asc" },
    take: BATCH,
    include: { user: { select: { email: true, name: true, ceoAutoRunLang: true } } },
  });

  const results: { siteId: string; ok: boolean; score?: number; emailed?: boolean; reason?: string }[] = [];
  for (const site of due) {
    const lang = (["fa", "en", "de", "tr"] as const).find((l) => l === site.user.ceoAutoRunLang) ?? "fa";
    try {
      const run = await auditAndSave(site.id, "auto", lang);
      if (!run.ok) { results.push({ siteId: site.id, ok: false, reason: run.failure.reason }); continue; }

      let emailed = false;
      if (run.notable && run.diff && site.user.email) {
        const d = run.diff;
        const top = d.added.slice(0, 5).map((i) => `<li>${escapeHtml(i.label)}${i.scope === "site" ? "" : ` — ${escapeHtml(i.scope)}`}</li>`).join("");
        try {
          await sendEmail(
            site.user.email,
            tri(lang, `گزارش سئو ${site.name || site.url}: امتیاز ${run.score}`, `SEO report for ${site.name || site.url}: score ${run.score}`, `SEO-Bericht für ${site.name || site.url}: Score ${run.score}`, `${site.name || site.url} SEO raporu: skor ${run.score}`),
            `<div dir="${lang === "fa" ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial;padding:24px;max-width:640px;">
              <h2>${escapeHtml(site.name || site.url)}</h2>
              <p>${tri(lang, `امتیاز سئو ${run.score} شد (${d.scoreDelta >= 0 ? "+" : ""}${d.scoreDelta} نسبت به تحلیل قبلی).`, `SEO score is now ${run.score} (${d.scoreDelta >= 0 ? "+" : ""}${d.scoreDelta} since the last audit).`, `Der SEO-Score liegt jetzt bei ${run.score} (${d.scoreDelta >= 0 ? "+" : ""}${d.scoreDelta} seit dem letzten Audit).`, `SEO skoru şimdi ${run.score} (${d.scoreDelta >= 0 ? "+" : ""}${d.scoreDelta}).`)}</p>
              ${top ? `<p>${tri(lang, "مشکلات جدید:", "New issues:", "Neue Probleme:", "Yeni sorunlar:")}</p><ul>${top}</ul>` : ""}
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com"}/seo/sites">${tri(lang, "مشاهده گزارش کامل در AiFekr", "View the full report in AiFekr", "Vollständigen Bericht in AiFekr ansehen", "Tam raporu AiFekr'de görüntüle")}</a></p>
            </div>`,
          );
          emailed = true;
        } catch (e) { console.error("seo-audits: email failed:", e); }
      }
      results.push({ siteId: site.id, ok: true, score: run.score, emailed });
    } catch (e) {
      console.error("seo-audits: audit failed:", e);
      // Push the schedule out so a persistently failing site cannot starve the queue.
      await prisma.seoSite.update({ where: { id: site.id }, data: { nextAuditAt: new Date(Date.now() + 6 * 60 * 60 * 1000) } }).catch(() => {});
      results.push({ siteId: site.id, ok: false, reason: "error" });
    }
  }
  return NextResponse.json({ ran: due.length, results });
}
