import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { defaultGrowthSettings, getGrowthSettings, saveGrowthSettings, type GrowthSettings } from "@/lib/growth/config";
import { loadFacts } from "@/lib/growth/facts";
import { linkSignup } from "@/lib/growth/events";
import { recordLinkTouch } from "@/lib/growth/serverTouch";
import { planFollowups, processFollowups } from "./engine";
import { holdoutVariant } from "./policy";
import { FOLLOWUP_SETTINGS_KEY, defaultFollowupSettings, saveFollowupSettings, type FollowupSettings } from "./settings";
import { liveCampaignFunnel, LIVE_CAMPAIGN } from "./liveCampaign";
import { conversionReport } from "./analytics";
import type { Adapters, Message } from "./channels";

/**
 * Runs the real engine against the isolated test database (prisma/vitest.db or
 * DATABASE_URL). Delivery goes through fake adapters: nothing leaves the machine,
 * and no address used here is real.
 */
const ACTOR = { id: `test-followup-admin-${Date.now()}`, role: "SUPER_ADMIN" };
const made: string[] = [];
let growthBefore: string | null = null, followupBefore: string | null = null;
const H = 3_600_000, D = 24 * H;
// Tehran 12:00 today: outside the default 22:00-08:00 quiet hours whatever time the tests run.
const NOW = new Date(new Date().toISOString().slice(0, 10) + "T08:30:00Z");

const inApp: Message[] = [], emails: Message[] = [];
let emailFailures = 0;
const fake: Adapters = {
  async inApp(tx, m) { inApp.push(m); const n = await tx.notification.create({ data: { userId: m.userId, type: m.type, title: m.title, body: m.body, link: m.link } }); return { notificationId: n.id }; },
  async email(to, m) { if (emailFailures-- > 0) throw new Error(`provider rejected ${to}`); emails.push(m); },
  emailConfigured: () => true,
};

async function user(over: { email?: string; consent?: boolean; intendedModule?: string; language?: string; createdAt?: Date } = {}) {
  const u = await prisma.user.create({ data: { name: "Followup Test", email: over.email ?? null, language: over.language ?? "fa", createdAt: over.createdAt ?? NOW, phone: `+98911${Math.floor(Math.random() * 1e7).toString().padStart(7, "0")}` } });
  made.push(u.id);
  if (over.consent || over.intendedModule) await prisma.growthProfile.create({ data: { userId: u.id, marketingConsent: !!over.consent, intendedModule: over.intendedModule ?? null } });
  return u;
}
async function setFollowup(over: Partial<FollowupSettings>) { return saveFollowupSettings({ ...defaultFollowupSettings(), ruleModes: { welcome: over.mode === "live" ? "live" : "dry_run", getting_started_24h: "dry_run", live_first_session: "dry_run" }, ...over }, ACTOR); }
async function setGrowth(mut: (g: GrowthSettings) => void) { const g = defaultGrowthSettings(); mut(g); return saveGrowthSettings(g, ACTOR.id); }
const liveGrowth = (rules: string[]) => setGrowth(g => { g.flags.lifecycle_automation_enabled = true; g.flags.automated_communications_enabled = true; g.messaging.enabledRules = rules; });
const jobsOf = (userId: string) => prisma.followupJob.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  growthBefore = (await prisma.siteSetting.findUnique({ where: { key: "growthSettings" } }))?.value ?? null;
  followupBefore = (await prisma.siteSetting.findUnique({ where: { key: FOLLOWUP_SETTINGS_KEY } }))?.value ?? null;
});
beforeEach(async () => {
  inApp.length = 0; emails.length = 0; emailFailures = 0;
  // Only this file's users ever have jobs; leftovers from a previous test must not be processed.
  await prisma.followupJob.updateMany({ where: { userId: { in: made }, status: "queued" }, data: { status: "cancelled", reason: "test_cleanup" } });
  await setGrowth(() => {});
  await setFollowup({});
});
afterAll(async () => {
  for (const [key, before] of [["growthSettings", growthBefore], [FOLLOWUP_SETTINGS_KEY, followupBefore]] as const) {
    if (before) await prisma.siteSetting.update({ where: { key }, data: { value: before } }); else await prisma.siteSetting.deleteMany({ where: { key } });
  }
  await prisma.growthTouch.deleteMany({ where: { utmCampaign: LIVE_CAMPAIGN.utmCampaign } });
  await prisma.auditLog.deleteMany({ where: { actorId: ACTOR.id } });
  await prisma.user.deleteMany({ where: { id: { in: made } } });
});

describe("follow-up engine (integration, fake delivery)", () => {
  it("does nothing at all while the engine is off (the default)", async () => {
    const u = await user();
    expect(await planFollowups({ now: NOW, userIds: [u.id] })).toMatchObject({ mode: null, planned: 0 });
    expect((await processFollowups({ now: NOW, adapters: fake })).disabled).toBe(true);
    expect(await jobsOf(u.id)).toHaveLength(0);
  });

  it("dry run records the intended send and notifies nobody", async () => {
    await setFollowup({ engine_enabled: true });
    const u = await user();
    expect(await planFollowups({ now: NOW, userIds: [u.id] })).toMatchObject({ mode: "dry_run", planned: 1, byRule: { welcome: 1 } });
    // One open job per user, and a key is used once: planning again adds nothing.
    expect((await planFollowups({ now: NOW, userIds: [u.id] })).planned).toBe(0);
    await processFollowups({ now: NOW, adapters: fake });
    const [job] = await jobsOf(u.id);
    expect(job).toMatchObject({ ruleKey: "welcome", mode: "dry_run", status: "dry_run", channel: "in_app", idempotencyKey: `dry:welcome:${u.id}` });
    expect(inApp).toHaveLength(0);
    expect(await prisma.notification.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.growthMessage.count({ where: { userId: u.id } })).toBe(0);
    // The dry-run counts toward the dry-run cap (1 per 24h), so nothing more is planned today.
    expect((await planFollowups({ now: new Date(NOW.getTime() + H), userIds: [u.id] })).planned).toBe(0);
  });

  it("re-checks opt-out, suppression and eligibility right before sending", async () => {
    await setFollowup({ engine_enabled: true });
    const [a, b, c] = [await user(), await user(), await user()];
    await planFollowups({ now: NOW, userIds: [a.id, b.id, c.id] });
    await prisma.growthProfile.create({ data: { userId: a.id, unsubscribedAt: new Date() } });
    await prisma.followupSuppression.create({ data: { userId: b.id, channel: "all", reason: "test", source: "admin" } });
    await prisma.generatedImage.create({ data: { userId: c.id, prompt: "x", url: "https://example.invalid/i.png" } }); // first value: welcome no longer applies
    await processFollowups({ now: NOW, adapters: fake });
    expect((await jobsOf(a.id))[0]).toMatchObject({ status: "suppressed", reason: "unsubscribed" });
    expect((await jobsOf(b.id))[0]).toMatchObject({ status: "suppressed", reason: "suppressed_all" });
    expect((await jobsOf(c.id))[0]).toMatchObject({ status: "suppressed", reason: "no_longer_eligible" });
  });

  it("sends live in-app only when every switch is on, once per key, and logs it as a GrowthMessage", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: true, email: false, push: false } });
    const u = await user();
    expect(await planFollowups({ now: NOW, userIds: [u.id] })).toMatchObject({ mode: "live", planned: 1 });
    await processFollowups({ now: NOW, adapters: fake });
    const [job] = await jobsOf(u.id);
    expect(job).toMatchObject({ status: "sent", channel: "in_app", idempotencyKey: `welcome:${u.id}` });
    expect(job.notificationId).toBeTruthy();
    expect(inApp.map(m => m.userId)).toEqual([u.id]);
    expect(await prisma.growthMessage.count({ where: { userId: u.id, status: "sent", idempotencyKey: `welcome:${u.id}` } })).toBe(1);
    // Later cycles never send it again; other scenarios that are still in dry run may only be recorded.
    await planFollowups({ now: new Date(NOW.getTime() + 2 * D), userIds: [u.id] });
    expect(await prisma.followupJob.count({ where: { userId: u.id, mode: "live" } })).toBe(1);
  });

  it("defers for the frequency cap and for quiet hours instead of dropping", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: true, email: false, push: false } });
    const [capped, late] = [await user(), await user()];
    await planFollowups({ now: NOW, userIds: [capped.id, late.id] });
    await prisma.growthMessage.create({ data: { userId: capped.id, ruleKey: "other", channel: "in_app", status: "sent", idempotencyKey: `other:${capped.id}`, createdAt: new Date(NOW.getTime() - 2 * H) } });
    await prisma.followupJob.updateMany({ where: { userId: late.id }, data: { nextAttemptAt: new Date(NOW.getTime() + 11 * H) } });
    await processFollowups({ now: NOW, adapters: fake });
    const [c] = await jobsOf(capped.id);
    expect(c).toMatchObject({ status: "queued", reason: "frequency_cap_per24h" });
    expect(c.nextAttemptAt.getTime()).toBe(NOW.getTime() + 22 * H);
    const lateNow = new Date(NOW.getTime() + 11 * H); // Tehran 23:00
    await processFollowups({ now: lateNow, adapters: fake });
    const [l] = await jobsOf(late.id);
    expect(l).toMatchObject({ status: "queued", reason: "quiet_hours" });
    expect(l.nextAttemptAt.toISOString()).toBe(new Date(NOW.getTime() + 20 * H).toISOString()); // Tehran 08:00 next day
    expect(inApp).toHaveLength(0);
  });

  it("retries a failed email with backoff, then fails it, redacting the address", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: false, email: true, push: false }, retry: { maxAttempts: 2, baseMinutes: 15, maxMinutes: 720 } });
    const u = await user({ email: `followup-${Date.now()}@example.invalid`, consent: true });
    await planFollowups({ now: NOW, userIds: [u.id] });
    emailFailures = 5;
    await processFollowups({ now: NOW, adapters: fake });
    let [job] = await jobsOf(u.id);
    expect(job).toMatchObject({ status: "queued", channel: "email", attempts: 1, reason: "retry" });
    expect(job.nextAttemptAt.getTime()).toBe(NOW.getTime() + 15 * 60_000);
    expect(job.lastError).toBe("provider rejected [email]");
    await processFollowups({ now: new Date(NOW.getTime() + 16 * 60_000), adapters: fake });
    [job] = await jobsOf(u.id);
    expect(job).toMatchObject({ status: "failed", reason: "max_attempts", attempts: 2 });
    expect(await prisma.growthMessage.count({ where: { userId: u.id } })).toBe(0);
    expect(emails).toHaveLength(0);
  });

  it("cancels queued live jobs when real sending is switched off", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: true, email: false, push: false } });
    const u = await user();
    await planFollowups({ now: NOW, userIds: [u.id] });
    await setFollowup({ engine_enabled: true, mode: "dry_run" });
    await processFollowups({ now: NOW, adapters: fake });
    expect((await jobsOf(u.id))[0]).toMatchObject({ status: "cancelled", reason: "dry_run_mode" });
    expect(inApp).toHaveLength(0);
  });

  it("holds out a deterministic share of users and never messages them", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: true, email: false, push: false }, holdoutPercent: 50 });
    const us = await Promise.all(Array.from({ length: 6 }, () => user()));
    await planFollowups({ now: NOW, userIds: us.map(u => u.id) });
    await processFollowups({ now: NOW, adapters: fake });
    for (const u of us) {
      const expected = holdoutVariant(u.id, "welcome", 50) === "holdout" ? "holdout" : "sent";
      expect((await jobsOf(u.id))[0].status).toBe(expected);
    }
    expect(new Set(inApp.map(m => m.userId))).toEqual(new Set(us.filter(u => holdoutVariant(u.id, "welcome", 50) === "treatment").map(u => u.id)));
    const report = await conversionReport({ from: new Date(NOW.getTime() - D), to: new Date(NOW.getTime() + D) });
    const welcome = report.find(r => r.key === "welcome")!;
    expect(welcome.sent.n + welcome.holdout.n).toBeGreaterThanOrEqual(6);
    expect(welcome.liftPoints).toBeNull(); // fewer than 30 per arm: no lift claimed
  });

  it("renders the user's language (de) in the sent message", async () => {
    await liveGrowth(["welcome"]);
    await setFollowup({ engine_enabled: true, mode: "live", channels: { in_app: true, email: false, push: false } });
    const u = await user({ language: "de" });
    await planFollowups({ now: NOW, userIds: [u.id] });
    await processFollowups({ now: NOW, adapters: fake });
    expect(inApp[0]).toMatchObject({ lang: "de", title: "Willkommen bei AIFekr, Followup" });
  });
});

describe("AIFekr Live: attribution and facts (integration)", () => {
  it("counts a Live call from session metadata and never counts a live transcript as chat", async () => {
    const u = await user();
    await prisma.liveVoiceSession.create({ data: { userId: u.id, providerSessionId: `test-${u.id}`, creditsPerMinute: 10, maxSeconds: 600, seconds: 45, status: "CLOSED" } });
    const conv = await prisma.conversation.create({ data: { userId: u.id, tool: "live", model: "aifekr-live" } });
    await prisma.message.create({ data: { conversationId: conv.id, role: "assistant", content: "live reply" } });
    const f = (await loadFacts([u.id], 30)).get(u.id)!;
    expect(f.successes.live?.count).toBe(1);
    expect(f.successes.chat).toBeUndefined();
  });

  it("records the DM link touch server-side, links it at sign-up and shows it in the funnel", async () => {
    const target = new URL(`http://localhost:3000/live?utm_source=instagram&utm_medium=comment_dm&utm_campaign=${LIVE_CAMPAIGN.utmCampaign}`);
    const req = new NextRequest("http://localhost:3000/api/social/instagram/campaigns/link?c=x&l=y");
    const res = NextResponse.redirect(target);
    const touchId = await recordLinkTouch(req, res, target);
    expect(touchId).toBeTruthy();
    const anon = res.cookies.get("afk_aid")?.value;
    expect(anon).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
    // A tenant's own site is never recorded.
    expect(await recordLinkTouch(req, NextResponse.redirect("https://example-shop.invalid/"), new URL("https://example-shop.invalid/?utm_campaign=x"))).toBeNull();
    const u = await user({ createdAt: new Date(Date.now() + 1000) });
    await linkSignup(u.id, anon, "/live");
    expect((await prisma.growthProfile.findUnique({ where: { userId: u.id } }))?.intendedModule).toBe("live");
    await prisma.liveVoiceSession.create({ data: { userId: u.id, providerSessionId: `funnel-${u.id}`, creditsPerMinute: 10, maxSeconds: 600, seconds: 40, status: "CLOSED", startedAt: new Date(Date.now() + 2000) } });
    const funnel = await liveCampaignFunnel();
    expect(funnel).toMatchObject({ attributedUsers: 1, signups: 1, liveStarted: 1, liveFirstValue: 1, buyers: 0 });
    expect(funnel.visits).toBeGreaterThanOrEqual(1);
  });

  it("plans the Live follow-up only with the campaign switch on, from day 1, for Live-campaign users", async () => {
    await setFollowup({ engine_enabled: true });
    const [off, u] = [await user({ intendedModule: "live" }), await user({ intendedModule: "live" })];
    const day2 = new Date(NOW.getTime() + 36 * H);
    // Campaign off: the generic day-1 guidance is planned instead (one open job per user).
    expect((await planFollowups({ now: day2, userIds: [off.id] })).byRule).toEqual({ getting_started_24h: 1 });
    await setFollowup({ engine_enabled: true, live_campaign_enabled: true });
    // Campaign on: the Live rule outranks the generic one.
    expect((await planFollowups({ now: day2, userIds: [u.id] })).byRule).toEqual({ live_first_session: 1 });
    expect((await jobsOf(u.id))[0]).toMatchObject({ campaignKey: LIVE_CAMPAIGN.utmCampaign, mode: "dry_run" });
  });

  it("keeps the stored settings readable by the growth config", async () => {
    expect((await getGrowthSettings()).weights.liveUsed).toBe(0);
  });
});
