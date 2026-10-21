import { prisma } from "@/lib/db/prisma";
import { sanitizeFreeText } from "@/lib/agents/crmAgent";
import { auditAndSave, parseSnapshot } from "@/lib/seo/siteAuditService";
import { diffAudits } from "@/lib/seo/siteAuditCore";
import { loadWpConn, testWordPress } from "@/lib/wordpress/client";
import type { WorkspaceContext } from "../isolation";
import { defineTool, validText, type NoArgs, type ToolDefinition } from "./types";

/**
 * SEO tools -- READ, plus one COMMIT (running a fresh audit).
 *
 * They read what the SEO Monitor already saved (scores for desktop AND mobile, the
 * issues found, the change since the last audit, the WordPress checks) and check the
 * WordPress connection, so the chat can answer "how is my site's SEO?" from real data
 * instead of general advice. Nothing here writes to a customer's website, and nothing
 * calls it "published": changes to a live site stay in the SEO Monitor, behind an
 * explicit button.
 *
 * Isolation: SEO sites belong to a user account, not to a team workspace, so these
 * tools are reachable only by the account owner (a team member or restricted agent is
 * refused rather than shown the owner's sites), and every query is scoped by the
 * workspace user and the active business.
 *
 * Text that came from a customer's own website (page titles, issue details) is
 * untrusted: it goes through sanitizeFreeText() before it can reach a prompt.
 */

const seoAccess = (ctx: WorkspaceContext): boolean => ctx.workspaceUserId === ctx.actingUserId && !ctx.isAgentRestricted;

const clean = (s: string, max = 160): string => sanitizeFreeText(s).slice(0, max);
const pathOf = (url: string): string => { try { const u = new URL(url); return u.pathname + u.search || "/"; } catch { return url.slice(0, 80); } };

const sitesFor = (ctx: WorkspaceContext) =>
  prisma.seoSite.findMany({ where: { userId: ctx.workspaceUserId, ...ctx.businessFilter }, orderBy: { createdAt: "asc" }, take: 25 });

/** A site named by what the user called it (its address or name), resolved to exactly one of THEIR sites. */
async function resolveSite(ctx: WorkspaceContext, query: string) {
  const q = query.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
  const all = await sitesFor(ctx);
  const hits = all.filter((s) => s.url.toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q));
  return hits.length === 1 ? hits[0] : null; // ambiguous or unknown: refuse rather than guess
}

export const seoSitesTool = defineTool<NoArgs>({
  key: "seo.sites",
  tier: "READ",
  capabilityKey: "seo",
  description: "The websites tracked in the SEO Monitor with their latest desktop and mobile SEO scores and when each was last audited. Use for 'which sites do I track', 'what's my SEO score' or 'is my SEO getting better'.",
  planSatisfied: seoAccess,
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const sites = await sitesFor(ctx);
    if (!sites.length) return { data: { sites: [], note: "No website is tracked yet; the user can add one in the SEO Monitor." }, empty: true };

    const latest = await Promise.all(sites.map((s) => prisma.seoAudit.findFirst({ where: { siteId: s.id }, orderBy: { createdAt: "desc" }, select: { score: true, mobileScore: true, createdAt: true, failCount: true, warnCount: true } })));
    return {
      data: {
        sites: sites.map((s, i) => ({
          id: s.id, name: clean(s.name || s.url, 80), url: s.url,
          desktopScore: latest[i]?.score ?? null, mobileScore: latest[i]?.mobileScore ?? null,
          failingChecks: latest[i]?.failCount ?? null, warnings: latest[i]?.warnCount ?? null,
          lastAudit: latest[i]?.createdAt ?? null, autoReAudit: s.autoAudit ? s.frequency : "off",
        })),
      },
    };
  },
});

interface AuditSummaryArgs { site?: string; resolved?: { siteId: string } }

export const seoAuditSummary = defineTool<AuditSummaryArgs>({
  key: "seo.auditSummary",
  tier: "READ",
  capabilityKey: "seo",
  description: "The latest saved SEO audit of one tracked website: desktop and mobile scores, the most important problems (including mobile-only and WordPress-specific ones), the weakest pages and what changed since the previous audit. Pass `site` as the address or name the user used; omit it only if the user has a single site.",
  planSatisfied: seoAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const site = o.site === undefined || o.site === null || o.site === "" ? undefined : validText(o.site, 120);
    if (site === null) return null;
    const r = o.resolved as Record<string, unknown> | undefined;
    return { site, ...(r && typeof r.siteId === "string" && /^[a-z0-9]{20,32}$/i.test(r.siteId) ? { resolved: { siteId: r.siteId } } : {}) };
  },
  prepare: async (args, ctx) => {
    if (args.site) {
      const site = await resolveSite(ctx, args.site);
      return site ? { ...args, resolved: { siteId: site.id } } : null;
    }
    const all = await sitesFor(ctx);
    return all.length === 1 ? { ...args, resolved: { siteId: all[0].id } } : all.length === 0 ? args : null; // several sites and none named: ask which
  },
  run: async (args, ctx) => {
    if (!args.resolved) return { data: { note: "No website is tracked yet; the user can add one in the SEO Monitor." }, empty: true };

    // Re-read under the workspace scope: the id came from `prepare`, minutes ago, and is never trusted as-is.
    const site = await prisma.seoSite.findFirst({ where: { id: args.resolved.siteId, userId: ctx.workspaceUserId, ...ctx.businessFilter } });
    if (!site) return { data: { note: "That website is not in this workspace." }, empty: true };

    const audits = await prisma.seoAudit.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 2 });
    if (!audits.length) return { data: { site: { name: clean(site.name || site.url, 80), url: site.url }, note: "This site has not been audited yet; the user can run the first audit in the SEO Monitor." }, empty: true };

    const [curr, prev] = audits;
    const snap = parseSnapshot(curr);
    const diff = prev ? diffAudits(parseSnapshot(prev), snap) : null;

    const rank = (s: string) => (s === "fail" ? 0 : 1);
    const issues = snap.pages.flatMap((p) => p.issues.map((i) => ({ page: pathOf(p.url), id: i.id, label: i.label, status: i.status, detail: i.detail })));
    const worst = [...issues].sort((a, b) => rank(a.status) - rank(b.status));
    const shape = (i: (typeof issues)[number]) => ({ page: i.page, problem: clean(i.label, 80), severity: i.status, detail: clean(i.detail) });

    return {
      data: {
        site: { name: clean(site.name || site.url, 80), url: site.url },
        audit: { when: curr.createdAt, source: curr.source, desktopScore: curr.score, mobileScore: curr.mobileScore, pagesChecked: curr.pagesCrawled, failing: curr.failCount, warnings: curr.warnCount },
        changeSinceLastAudit: diff ? { scoreDelta: diff.scoreDelta, fixed: diff.fixed.length, stillOpen: diff.remaining, newProblems: diff.added.slice(0, 5).map((i) => clean(i.label, 80)) } : null,
        topProblems: worst.filter((i) => !i.id.startsWith("mobile_") && !i.id.startsWith("wp")).slice(0, 8).map(shape),
        mobileProblems: worst.filter((i) => i.id.startsWith("mobile_")).slice(0, 6).map(shape),
        wordpressProblems: worst.filter((i) => i.id.startsWith("wp")).slice(0, 5).map(shape),
        siteWideProblems: snap.siteIssues.slice(0, 5).map((i) => ({ problem: clean(i.label, 80), severity: i.status, detail: clean(i.detail) })),
        weakestPages: [...snap.pages].sort((a, b) => a.score - b.score).slice(0, 3).map((p) => ({ page: pathOf(p.url), desktopScore: p.score, mobileScore: p.mobileScore ?? null })),
        improvementPlanSaved: !!curr.plan,
      },
    };
  },
});

export const seoWordpressStatus = defineTool<NoArgs>({
  key: "seo.wordpressStatus",
  tier: "READ",
  capabilityKey: "seo",
  description: "Whether the user's WordPress site is connected to AiFekr for publishing and SEO, whether the connection works, whether the account may publish, and which SEO plugin (Yoast / Rank Math) the site runs. Use for WordPress publishing or WordPress SEO questions.",
  planSatisfied: seoAccess,
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const conn = await loadWpConn(ctx.workspaceUserId);
    if (!conn) return { data: { connected: false, note: "No WordPress site is connected; the user can connect one in the SEO Monitor." }, empty: true };
    const t = await testWordPress(conn);
    return { data: t.ok ? { connected: true, working: true, siteName: clean(t.siteName, 80), seoPlugin: t.seoPlugin, canPublishPosts: t.canPublish } : { connected: true, working: false, problem: t.reason } };
  },
});

interface RunAuditArgs { site?: string; resolved?: { siteId: string; siteName: string; url: string } }

export const seoRunAudit = defineTool<RunAuditArgs>({
  key: "seo.runAudit",
  tier: "COMMIT",
  capabilityKey: "seo",
  description: "Run a fresh SEO audit of one tracked website now (crawls up to 10 pages on desktop and mobile and saves the result). Free, but it reaches out to the website, so the user must confirm. Pass `site` as the address or name the user used.",
  planSatisfied: seoAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const site = o.site === undefined || o.site === null || o.site === "" ? undefined : validText(o.site, 120);
    if (site === null) return null;
    const r = o.resolved as Record<string, unknown> | undefined;
    if (r) {
      const siteId = typeof r.siteId === "string" && /^[a-z0-9]{20,32}$/i.test(r.siteId) ? r.siteId : null;
      const siteName = validText(r.siteName, 120);
      const url = validText(r.url, 300);
      if (!siteId || !siteName || !url) return null;
      return { site, resolved: { siteId, siteName, url } };
    }
    return { site };
  },
  prepare: async (args, ctx) => {
    const site = args.site ? await resolveSite(ctx, args.site) : await sitesFor(ctx).then((all) => (all.length === 1 ? all[0] : null));
    return site ? { ...args, resolved: { siteId: site.id, siteName: clean(site.name || site.url, 120), url: site.url } } : null;
  },
  summarize: (args, _ctx, lang) => {
    const name = args.resolved?.siteName ?? args.site ?? "";
    if (lang === "fa") return `تحلیل جدید سئوی «${name}» اجرا شود (تا ۱۰ صفحه، دسکتاپ و موبایل — رایگان)`;
    if (lang === "de") return `Neue SEO-Analyse für „${name}" starten (bis zu 10 Seiten, Desktop und Mobil — kostenlos)`;
    return `Run a fresh SEO audit of "${name}" (up to 10 pages, desktop and mobile — free)`;
  },
  run: async (args, ctx) => {
    if (!args.resolved) return { data: { ran: false, reason: "reference_not_resolved" } };
    const site = await prisma.seoSite.findFirst({ where: { id: args.resolved.siteId, userId: ctx.workspaceUserId, ...ctx.businessFilter } });
    if (!site) return { data: { ran: false, reason: "site_not_in_this_workspace" } };

    // Same courtesy limit as the button: an audit crawls someone else's server.
    if (site.lastAuditAt && Date.now() - site.lastAuditAt.getTime() < 2 * 60 * 1000) return { data: { ran: false, reason: "audited_less_than_two_minutes_ago" } };

    const run = await auditAndSave(site.id, "manual", ctx.lang);
    if (!run.ok) return { data: { ran: false, reason: `site_not_reachable_${run.failure.reason}` } };
    const saved = await prisma.seoAudit.findUnique({ where: { id: run.auditId }, select: { score: true, mobileScore: true, failCount: true, warnCount: true } });
    return { data: { ran: true, site: clean(site.name || site.url, 80), desktopScore: saved?.score ?? run.score, mobileScore: saved?.mobileScore ?? null, failing: saved?.failCount ?? null, warnings: saved?.warnCount ?? null, scoreChange: run.diff?.scoreDelta ?? null } };
  },
});

export const SEO_TOOLS: ToolDefinition<never>[] = [seoSitesTool, seoAuditSummary, seoWordpressStatus, seoRunAudit] as unknown as ToolDefinition<never>[];
