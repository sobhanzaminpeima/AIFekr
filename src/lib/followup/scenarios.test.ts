import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { defaultGrowthSettings } from "@/lib/growth/config";
import { RULES, retryLink, ruleContext, ruleMessage } from "@/lib/growth/automation";
import { inferredSocialSource, parseTouch, touchConfidence, touchKey } from "@/lib/growth/attribution";
import { createUser } from "@/lib/repositories/userRepository";
import { saveFreeCreditsPolicy } from "@/lib/credits/freeCredits";
import type { CustomerFacts } from "@/lib/growth/lifecycle";

const now = new Date("2026-11-06T08:30:00Z");
const H = 3_600_000, D = 24 * H;
const facts = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  userId: "u1", createdAt: new Date(now.getTime() - 5 * D), plan: "FREE", planExpiry: null, credits: 80, role: "USER", onboardingDone: true, onboardingState: "completed",
  successes: {}, failedOperations: 0, creditsUsedWindow: 0, activeDaysWindow: 1, lastActiveAt: new Date(now.getTime() - H), pricingViewsWindow: 0, demoRequests: 0, checkoutsWindow: 0,
  payments: { success: 0, failed: 0, pending: 0, revenueToman: 0, firstPaidAt: null, lastFailedAt: null }, unsubscribed: false, marketingConsent: false, ...over,
});
const user = { id: "u1", name: "Sara", firstName: null, language: "fa", plan: "FREE", credits: 80, growthProfile: null };
const rule = (k: string) => RULES.find(r => r.key === k)!;
const eligible = (k: string, f: CustomerFacts) => rule(k).eligible(ruleContext(user, f, defaultGrowthSettings(), now));

describe("owner-approved scenarios (dry run first)", () => {
  it("A: no meaningful action 24h after sign-up", () => {
    expect(eligible("getting_started_24h", facts({ createdAt: new Date(now.getTime() - 26 * H) }))).toBe(true);
    expect(eligible("getting_started_24h", facts({ createdAt: new Date(now.getTime() - 10 * H) }))).toBe(false);
    expect(eligible("getting_started_24h", facts({ createdAt: new Date(now.getTime() - 26 * H), successes: { image: { count: 1, first: new Date(now.getTime() - 20 * H) } } }))).toBe(false);
  });
  it("C: from 30 minutes after the first successful result, for two days", () => {
    const at = (mins: number) => facts({ successes: { image: { count: 1, first: new Date(now.getTime() - mins * 60_000) } } });
    expect(eligible("first_result_30m", at(10))).toBe(false);
    expect(eligible("first_result_30m", at(31))).toBe(true);
    expect(eligible("first_result_30m", at(3 * 24 * 60))).toBe(false);
  });
  it("G: failed or cancelled checkout, retry link to the same plan and period, not after a later success", () => {
    const failed = facts({ payments: { success: 0, failed: 1, pending: 0, revenueToman: 0, firstPaidAt: null, lastFailedAt: new Date(now.getTime() - 2 * H), lastFailedPlan: "CHAT_ECO_30", lastFailedPeriodMonths: 3, lastSuccessAt: null } });
    expect(eligible("payment_failed", failed)).toBe(true);
    expect(retryLink({ f: failed })).toBe("/plans?plan=CHAT_ECO_30&period=quarterly");
    expect(rule("payment_failed").link(ruleContext(user, failed, defaultGrowthSettings(), now))).toBe("/plans?plan=CHAT_ECO_30&period=quarterly");
    expect(ruleMessage(rule("payment_failed"), user, ruleContext(user, failed, defaultGrowthSettings(), now)).body).toContain("واریز بانکی");
    expect(eligible("payment_failed", facts({ payments: { ...failed.payments, lastSuccessAt: new Date(now.getTime() - H) } }))).toBe(false);
    expect(retryLink({ f: facts() })).toBe("/plans");
  });
  it("H: had a result and has been away 3 days, before the long-inactive threshold", () => {
    const away = (d: number) => facts({ successes: { chat: { count: 4, first: new Date(now.getTime() - 10 * D) } }, lastActiveAt: new Date(now.getTime() - d * D) });
    expect(eligible("inactive_3d", away(2))).toBe(false);
    expect(eligible("inactive_3d", away(3))).toBe(true);
    expect(eligible("inactive_3d", away(20))).toBe(false); // the 14-day rule takes over
  });
});

describe("attribution inferred from social referrers", () => {
  it("records instagram/facebook as source with medium social, never over real UTM", () => {
    const own = ["aifekr.com"];
    const ig = parseTouch("/live", "https://l.instagram.com/?u=x", own)!;
    expect(ig).toMatchObject({ confidence: "referrer", touch: { utmSource: "instagram", utmMedium: "social", referrerHost: "l.instagram.com" } });
    expect(parseTouch("/", "https://m.facebook.com/", own)!.touch.utmSource).toBe("facebook");
    const real = parseTouch("/live?utm_source=telegram&utm_campaign=x1", "https://l.instagram.com/", own)!;
    expect(real.touch).toMatchObject({ utmSource: "telegram", utmCampaign: "x1" });
    expect(parseTouch("/", "https://google.com/", own)!.touch.utmSource).toBeUndefined();
    expect(inferredSocialSource("www.instagram.com")).toBe("instagram");
    expect(touchConfidence(ig.touch)).toBe("referrer");
    expect(touchKey({ utmCampaign: null, utmSource: "instagram", referrerHost: "l.instagram.com" })).toBe("src:instagram");
  });
});

describe("admin invites are not sign-up promotions", () => {
  const made: string[] = [], ACTOR = `invite-promo-${Date.now()}`;
  let before: string | null = null;
  afterAll(async () => {
    if (before) await prisma.siteSetting.update({ where: { key: "freeCreditsPolicy" }, data: { value: before } }); else await prisma.siteSetting.deleteMany({ where: { key: "freeCreditsPolicy" } });
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: made } } });
    await prisma.auditLog.deleteMany({ where: { actorId: ACTOR } });
    await prisma.user.deleteMany({ where: { id: { in: made } } });
  });
  it("keeps an invited account's starting credits out of the expiring promotion", async () => {
    before = (await prisma.siteSetting.findUnique({ where: { key: "freeCreditsPolicy" } }))?.value ?? null;
    await saveFreeCreditsPolicy(ACTOR, { enabled: true, signup: 100, activationBonus: 50, expiryDays: 14 });
    await new Promise(r => setTimeout(r, 20));
    const admin = await prisma.user.create({ data: { name: "Inviting admin", role: "ADMIN" } }); made.push(admin.id);
    const invited = await createUser({ name: "Invited", credits: 200, invitedByAdminId: admin.id }); made.push(invited.id);
    const signup = await createUser({ name: "Self signup", credits: 100 }); made.push(signup.id);
    const meta = async (id: string) => (await prisma.creditLedgerEntry.findUnique({ where: { operationId: `signup:${id}` } }))?.metadata ?? null;
    expect(await meta(invited.id)).toBeNull();
    expect(JSON.parse((await meta(signup.id))!)).toMatchObject({ promo: true });
  });
});
