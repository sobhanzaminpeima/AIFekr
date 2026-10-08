import { beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { queueSeoResearch, failSeoJob, processSeoQueue, reconcileSeoJobs } from "./jobs";
import { seoRequestSchema, runProviderResearch, SeoProviderError } from "./provider";
import { SEO_PROVIDER_SETTING, seoConfigSchema } from "./config";
vi.mock("./provider", async original => ({ ...await original<typeof import("./provider")>(), runProviderResearch: vi.fn() }));
vi.mock("./markets", () => ({ validateSeoMarket: vi.fn().mockResolvedValue(undefined) }));
const suffix = `seo-test-${Date.now()}`;
const owner = `${suffix}-owner`, outsider = `${suffix}-outsider`, siteId = `${suffix}-site`;
let oldSetting: string | null = null;
let saved = false;
const input = () => seoRequestSchema.parse({ action: "keywords", siteId, keyword: "prompt engineering", locationCode: 2840, languageCode: "en" });
const key = (n: number) => `${suffix}-request-${n}`;
beforeEach(async () => {
  if (!saved) { oldSetting = (await prisma.siteSetting.findUnique({ where: { key: SEO_PROVIDER_SETTING } }))?.value || null; saved = true; }
  await prisma.seoResearchJob.deleteMany({ where: { userId: { in: [owner, outsider] } } });
  await prisma.usageLog.deleteMany({ where: { userId: { in: [owner, outsider] } } });
  for (const id of [owner, outsider]) await prisma.user.upsert({ where: { id }, create: { id, name: "Isolated SEO test", credits: 150, aiCredits: 150 }, update: { credits: 150, aiCredits: 150, isBlocked: false, planExpiry: null, activeBusinessId: null } });
  await prisma.seoSite.upsert({ where: { id: siteId }, create: { id: siteId, userId: owner, url: "https://example.com/", verifiedAt: new Date() }, update: { verifiedAt: new Date() } });
  const config = seoConfigSchema.parse({ enabled: true, login: "test", password: "test", rates: { keywords: { baseUsd: 0.5, rowUsd: 0 }, rank: null, competitors: null, backlinks: null, referringDomains: null }, dailyCredits: 200, maxConcurrent: 1 });
  await prisma.siteSetting.upsert({ where: { key: SEO_PROVIDER_SETTING }, create: { key: SEO_PROVIDER_SETTING, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
  vi.mocked(runProviderResearch).mockReset();
});
afterAll(async () => {
  await prisma.seoResearchJob.deleteMany({ where: { userId: { in: [owner, outsider] } } });
  await prisma.usageLog.deleteMany({ where: { userId: { in: [owner, outsider] } } });
  await prisma.seoSite.deleteMany({ where: { id: siteId } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: [owner, outsider] } } });
  await prisma.team.deleteMany({ where: { ownerId: owner } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
  if (oldSetting !== null) await prisma.siteSetting.update({ where: { key: SEO_PROVIDER_SETTING }, data: { value: oldSetting } });
  else await prisma.siteSetting.deleteMany({ where: { key: SEO_PROVIDER_SETTING } });
});
describe("SEO durable credit and scope guarantees", () => {
  it("reserves once and commits successful provider result to existing ledger", async () => {
    await queueSeoResearch(owner, input(), key(1), 50);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(100);
    vi.mocked(runProviderResearch).mockResolvedValue({ data: [{ keyword: "prompt engineering" }], actualCostUsd: 0.5, providerTaskId: "provider-test" });
    await processSeoQueue();
    const job = await prisma.seoResearchJob.findFirstOrThrow({ where: { userId: owner } });
    expect(job.status).toBe("SUCCEEDED");
    expect((await prisma.usageLog.findUniqueOrThrow({ where: { id: job.usageLogId } })).actualCostUsd).toBe(0.5);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(100);
  });
  it("refuses insufficient funds before provider work", async () => {
    await prisma.user.update({ where: { id: owner }, data: { credits: 49 } });
    await expect(queueSeoResearch(owner, input(), key(2), 50)).rejects.toThrow("INSUFFICIENT_CREDITS");
    expect(await prisma.seoResearchJob.count({ where: { userId: owner } })).toBe(0);
    expect(runProviderResearch).not.toHaveBeenCalled();
  });
  it("duplicate request cannot double-charge; changed payload conflicts", async () => {
    const first = await queueSeoResearch(owner, input(), key(3), 50);
    const duplicate = await queueSeoResearch(owner, input(), key(3), 50);
    expect(duplicate.id).toBe(first.id);
    expect(await prisma.usageLog.count({ where: { userId: owner } })).toBe(1);
    await expect(queueSeoResearch(owner, { ...input(), keyword: "different" }, key(3), 50)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("refunds failed generation exactly once with a SEO refund entry", async () => {
    const job = await queueSeoResearch(owner, input(), key(4), 50);
    expect(await failSeoJob(job.id, "PROVIDER_HTTP_ERROR")).toBe(true);
    expect(await failSeoJob(job.id, "PROVIDER_HTTP_ERROR")).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(150);
    expect(await prisma.usageLog.count({ where: { userId: owner, type: "seo_research", credits: -50 } })).toBe(1);
  });
  it("rejects another user's site and requires real ownership", async () => {
    await expect(queueSeoResearch(outsider, input(), key(5), 50)).rejects.toThrow("SITE_NOT_FOUND");
    await prisma.seoSite.update({ where: { id: siteId }, data: { verifiedAt: null } });
    await expect(queueSeoResearch(owner, input(), key(5), 50)).rejects.toThrow("SITE_VERIFICATION_REQUIRED");
  });
  it("expired worker reservation is refunded and not replayed", async () => {
    const job = await queueSeoResearch(owner, input(), key(6), 50);
    await prisma.seoResearchJob.update({ where: { id: job.id }, data: { status: "RUNNING", expiresAt: new Date(Date.now() - 1000) } });
    expect(await reconcileSeoJobs()).toBeGreaterThanOrEqual(1);
    await processSeoQueue();
    expect(runProviderResearch).not.toHaveBeenCalled();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(150);
  });
  it("expired subscription cannot reserve or execute", async () => {
    await prisma.user.update({ where: { id: owner }, data: { planExpiry: new Date(Date.now() - 1000) } });
    await expect(queueSeoResearch(owner, input(), key(7), 50)).rejects.toThrow("INSUFFICIENT_CREDITS");
  });
  it("refunds the original payer even after joining another team", async () => {
    const job = await queueSeoResearch(owner, input(), key(8), 50);
    const team = await prisma.team.create({ data: { ownerId: owner, name: "Isolated payer change", credits: 99, aiCredits: 99 } });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: owner, role: "OWNER" } });
    await failSeoJob(job.id, "PROVIDER_HTTP_ERROR");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(150);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).credits).toBe(99);
  });
  it("preserves reported provider expense while refunding a failed task", async () => {
    const job = await queueSeoResearch(owner, input(), key(9), 50);
    vi.mocked(runProviderResearch).mockRejectedValue(new SeoProviderError("PROVIDER_TASK_FAILED", 0.15));
    await processSeoQueue();
    const final = await prisma.seoResearchJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe("FAILED");
    expect(final.actualCostUsd).toBe(0.15);
    expect(final.refundedAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(150);
  });
  it("archiving a queued site prevents provider work and releases credits", async () => {
    const job = await queueSeoResearch(owner, input(), key(10), 50);
    await prisma.seoSite.update({ where: { id: siteId }, data: { archivedAt: new Date() } });
    await processSeoQueue();
    expect(runProviderResearch).not.toHaveBeenCalled();
    expect((await prisma.seoResearchJob.findUniqueOrThrow({ where: { id: job.id } })).refundedAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(150);
  });
});
