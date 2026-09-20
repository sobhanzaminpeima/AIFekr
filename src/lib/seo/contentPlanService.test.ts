import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";

const runContentPipeline = vi.fn();
vi.mock("@/lib/agents/runContentPipeline", () => ({ runContentPipeline: (...a: unknown[]) => runContentPipeline(...a) }));

import { runContentPlan } from "./contentPlanService";

const P = `cplan${Date.now().toString(36)}`;
const userId = `${P}u`;
let planId = "";

const plan = () => prisma.seoContentPlan.findUniqueOrThrow({ where: { id: planId } });
const credits = async () => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits;

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, name: "u", credits: 100 } });
  const site = await prisma.seoSite.create({ data: { userId, url: "https://blog.test/", name: "blog.test" } });
  const p = await prisma.seoContentPlan.create({ data: { siteId: site.id, userId, enabled: true, theme: "Real estate in Berlin", topics: JSON.stringify(["First topic", "Second topic"]), frequency: "weekly", mode: "draft", lang: "en" } });
  planId = p.id;
});

beforeEach(async () => {
  runContentPipeline.mockReset();
  await prisma.seoContentPlan.update({ where: { id: planId }, data: { runningSince: null, lastError: null } });
  await prisma.user.update({ where: { id: userId }, data: { credits: 100 } });
});

afterAll(async () => {
  await prisma.usageLog.deleteMany({ where: { userId } });
  await prisma.contentPipelineRun.deleteMany({ where: { userId } });
  await prisma.seoConnection.deleteMany({ where: { userId } });
  await prisma.seoSite.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("runContentPlan", () => {
  it("writes the next queued topic, consumes it, bills the pipeline and schedules the next run", async () => {
    runContentPipeline.mockImplementationOnce(async (o: { runId: string; userId: string }) => {
      const post = await prisma.contentPost.create({ data: { userId: o.userId, runId: o.runId, title: "T", content: "c", metaTitle: "m", metaDescription: "d", slug: "t", keywords: "k", externalStatus: "not_published" } });
      return { postId: post.id, publishResult: { status: "not_published", url: null, error: null } };
    });
    const before = await credits();
    const res = await runContentPlan(planId);
    expect(res.ok).toBe(true);

    const call = runContentPipeline.mock.calls[0][0];
    expect(call.topic).toBe("First topic");
    expect(call.lang).toBe("en");
    expect(call.publishMode).toBe("hold"); // draft requested, but no WordPress site is connected -> kept in AiFekr

    const p = await plan();
    expect(JSON.parse(p.topics)).toEqual(["Second topic"]);
    expect(p.lastRunAt).not.toBeNull();
    expect(p.runningSince).toBeNull();
    expect(p.nextRunAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(await credits()).toBeLessThan(before);
    expect(await prisma.contentPipelineRun.count({ where: { planId } })).toBeGreaterThan(0);
  });

  it("uses a WordPress draft when a site is connected", async () => {
    await prisma.seoConnection.create({ data: { userId, platform: "wordpress", siteUrl: "https://blog.test", wpUsername: "u", wpAppPassword: "p" } });
    runContentPipeline.mockResolvedValueOnce({ postId: "x", publishResult: { status: "published", url: "https://blog.test/p", error: null } });
    await runContentPlan(planId);
    expect(runContentPipeline.mock.calls[0][0].publishMode).toBe("draft");
  });

  it("falls back to the theme once the queue is empty", async () => {
    await prisma.seoContentPlan.update({ where: { id: planId }, data: { topics: "[]" } });
    runContentPipeline.mockResolvedValueOnce({ postId: "x", publishResult: { status: "not_published", url: null, error: null } });
    await runContentPlan(planId);
    expect(runContentPipeline.mock.calls[0][0].topic).toBe("Real estate in Berlin");
    expect(await plan().then((p) => p.topics)).toBe("[]");
  });

  it("refunds the credits and keeps the topic when the chain fails, then retries later", async () => {
    await prisma.seoContentPlan.update({ where: { id: planId }, data: { topics: JSON.stringify(["Keep me"]) } });
    runContentPipeline.mockRejectedValueOnce(new Error("model exploded"));
    const before = await credits();
    const res = await runContentPlan(planId);
    expect(res).toMatchObject({ ok: false, reason: "failed" });
    expect(await credits()).toBe(before); // refunded
    const p = await plan();
    expect(JSON.parse(p.topics)).toEqual(["Keep me"]);
    expect(p.lastError).toContain("model exploded");
    expect(p.runningSince).toBeNull();
    expect(p.nextRunAt!.getTime()).toBeLessThan(Date.now() + 7 * 60 * 60 * 1000); // soon, not a whole period away
  });

  it("does not run (or charge) when the user cannot pay", async () => {
    await prisma.user.update({ where: { id: userId }, data: { credits: 0 } });
    const res = await runContentPlan(planId);
    expect(res).toMatchObject({ ok: false, reason: "insufficient_credits" });
    expect(runContentPipeline).not.toHaveBeenCalled();
    expect((await plan()).runningSince).toBeNull();
  });

  it("refuses to start a plan that is already running, but takes over a dead run", async () => {
    await prisma.seoContentPlan.update({ where: { id: planId }, data: { runningSince: new Date() } });
    expect(await runContentPlan(planId)).toMatchObject({ ok: false, reason: "already_running" });
    expect(runContentPipeline).not.toHaveBeenCalled();

    await prisma.seoContentPlan.update({ where: { id: planId }, data: { runningSince: new Date(Date.now() - 60 * 60 * 1000) } });
    runContentPipeline.mockResolvedValueOnce({ postId: "x", publishResult: { status: "not_published", url: null, error: null } });
    expect((await runContentPlan(planId)).ok).toBe(true);
  });

  it("reports there is nothing to write when there are no topics and no theme", async () => {
    await prisma.seoContentPlan.update({ where: { id: planId }, data: { topics: "[]", theme: "" } });
    expect(await runContentPlan(planId)).toMatchObject({ ok: false, reason: "no_topic" });
    await prisma.seoContentPlan.update({ where: { id: planId }, data: { theme: "Real estate in Berlin" } });
  });
});
