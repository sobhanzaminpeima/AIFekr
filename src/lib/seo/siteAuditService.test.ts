import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";

// The crawl needs the network; what is under test here is persistence, history, diffing and scheduling.
const runSiteAudit = vi.fn();
vi.mock("@/lib/seo/siteAudit", () => ({ runSiteAudit: (...a: unknown[]) => runSiteAudit(...a) }));

import { auditAndSave, siteLimitFor } from "./siteAuditService";

const P = `seosvc${Date.now().toString(36)}`;
const userId = `${P}u`;
let siteId = "";

const issue = (id: string, status: "fail" | "warning") => ({ id, label: id, status, detail: "" });
const result = (score: number, issues: ReturnType<typeof issue>[], siteIssues: ReturnType<typeof issue>[] = []) => ({
  ok: true as const,
  result: {
    score, pagesCrawled: 1, failCount: issues.filter((i) => i.status === "fail").length, warnCount: issues.filter((i) => i.status === "warning").length, passCount: 20,
    pages: [{ url: "https://s.test/", score, statusCode: 200, title: "t", h1Count: 1, wordCount: 300, responseMs: 100, issues }],
    siteIssues,
  },
});

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, name: "seo user" } });
  const site = await prisma.seoSite.create({ data: { userId, url: "https://s.test/", name: "s.test", frequency: "weekly" } });
  siteId = site.id;
});

afterAll(async () => {
  await prisma.seoAudit.deleteMany({ where: { userId } });
  await prisma.seoSite.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("auditAndSave", () => {
  it("saves the first audit, updates the site and schedules the next one", async () => {
    runSiteAudit.mockResolvedValueOnce(result(70, [issue("h1", "fail"), issue("title", "warning")], [issue("sitemap", "warning")]));
    const run = await auditAndSave(siteId, "manual", "en");
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.diff).toBeNull(); // nothing to compare with yet

    const site = await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } });
    expect(site.lastScore).toBe(70);
    expect(site.lastAuditAt).not.toBeNull();
    expect(site.nextAuditAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000); // weekly
  });

  it("diffs against the previous audit: what was fixed, what is new, and whether it is worth an email", async () => {
    runSiteAudit.mockResolvedValueOnce(result(85, [issue("title", "warning"), issue("canonical", "warning")], []));
    const run = await auditAndSave(siteId, "auto", "en");
    if (!run.ok) throw new Error("expected ok");
    expect(run.diff!.scoreDelta).toBe(15);
    expect(run.diff!.fixed.map((i) => i.id).sort()).toEqual(["h1", "sitemap"]);
    expect(run.diff!.added.map((i) => i.id)).toEqual(["canonical"]);
    expect(run.notable).toBe(false); // an improvement is not an alert

    const audits = await prisma.seoAudit.findMany({ where: { siteId }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.source)).toEqual(["manual", "auto"]);
  });

  it("flags a real regression as notable", async () => {
    runSiteAudit.mockResolvedValueOnce(result(60, [issue("indexable", "fail")], []));
    const run = await auditAndSave(siteId, "auto", "en");
    if (!run.ok) throw new Error("expected ok");
    expect(run.notable).toBe(true);
  });

  it("keeps the schedule moving when the site is unreachable, and saves no audit", async () => {
    const before = await prisma.seoAudit.count({ where: { siteId } });
    await prisma.seoSite.update({ where: { id: siteId }, data: { nextAuditAt: new Date(Date.now() - 1000) } });
    runSiteAudit.mockResolvedValueOnce({ ok: false, failure: { reason: "unreachable" } });
    const run = await auditAndSave(siteId, "auto", "en");
    expect(run.ok).toBe(false);
    expect(await prisma.seoAudit.count({ where: { siteId } })).toBe(before);
    const site = await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } });
    expect(site.nextAuditAt!.getTime()).toBeGreaterThan(Date.now()); // not left overdue -> not retried every tick
  });

  it("does not schedule anything for a site with auto-audit switched off", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { autoAudit: false } });
    runSiteAudit.mockResolvedValueOnce(result(80, []));
    await auditAndSave(siteId, "manual", "en");
    expect((await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).nextAuditAt).toBeNull();
  });
});

describe("siteLimitFor", () => {
  it("scales with the plan and defaults sensibly", () => {
    expect(siteLimitFor("FREE")).toBe(1);
    expect(siteLimitFor(null)).toBe(1);
    expect(siteLimitFor("PRO")).toBeGreaterThan(siteLimitFor("FREE"));
    expect(siteLimitFor("SOMETHING_NEW")).toBe(3);
  });
});
