import { describe, expect, it } from "vitest";
import { defaultGrowthSettings } from "@/lib/growth/config";
import { backoffMinutes, capDecision, chooseChannel, holdoutVariant, jobModeFor, liveSendBlockers, quietUntil } from "./policy";
import { defaultFollowupSettings, followupSettingsSchema, outreachEscalations } from "./settings";
import { jobKey, orderedRules, planningMode, plannableRules } from "./engine";
import { RULES, messageLang, ruleContext, ruleMessage } from "@/lib/growth/automation";
import { isOwnHost } from "@/lib/growth/serverTouch";
import { LIVE_CAMPAIGN, liveCampaignUrl } from "./liveCampaign";
import { moduleForPath, parseTouch, safeInternalPath } from "@/lib/growth/attribution";
import type { CustomerFacts } from "@/lib/growth/lifecycle";

const H = 3_600_000, D = 24 * H;
const now = new Date("2026-11-05T08:30:00Z"); // Tehran 12:00

describe("follow-up settings", () => {
  it("defaults to everything off, dry run, 1 per 24h and 3 per 7 days", () => {
    const s = defaultFollowupSettings();
    expect(s).toMatchObject({ engine_enabled: false, mode: "dry_run", channels: { in_app: false, email: false, push: false }, caps: { per24h: 1, per7d: 3 }, holdoutPercent: 0, live_campaign_enabled: false });
  });
  it("flags every change that can start outreach", () => {
    const off = defaultFollowupSettings();
    expect(outreachEscalations(off, { ...off, engine_enabled: true })).toEqual([]);
    expect(outreachEscalations(off, { ...off, mode: "live" })).toContain("mode_live");
    expect(outreachEscalations(off, { ...off, channels: { ...off.channels, email: true } })).toEqual(["channel_email"]);
    expect(outreachEscalations(off, { ...off, live_campaign_enabled: true })).toEqual(["live_campaign"]);
  });
  it("rejects out-of-range values", () => {
    expect(followupSettingsSchema.safeParse({ holdoutPercent: 80 }).success).toBe(false);
    expect(followupSettingsSchema.safeParse({ mode: "blast" }).success).toBe(false);
  });
});

describe("follow-up policy", () => {
  it("backs off exponentially up to the cap", () => {
    const r = defaultFollowupSettings().retry;
    expect([1, 2, 3, 4].map(a => backoffMinutes(a, r))).toEqual([15, 30, 60, 120]);
    expect(backoffMinutes(20, r)).toBe(720);
  });
  it("caps at 1 per 24 hours and 3 per 7 days, with the time the cap frees up", () => {
    const caps = { per24h: 1, per7d: 3 };
    expect(capDecision([], now, caps).ok).toBe(true);
    const one = capDecision([new Date(now.getTime() - 2 * H)], now, caps);
    expect(one).toEqual({ ok: false, cap: "per24h", retryAt: new Date(now.getTime() + 22 * H) });
    const week = capDecision([2, 3, 5].map(d => new Date(now.getTime() - d * D)), now, caps);
    expect(week).toEqual({ ok: false, cap: "per7d", retryAt: new Date(now.getTime() + 2 * D) });
    expect(capDecision([2, 3, 8].map(d => new Date(now.getTime() - d * D)), now, caps).ok).toBe(true);
  });
  it("moves a send in Tehran quiet hours to the end of the window", () => {
    expect(quietUntil(now, 22, 8)).toBeNull();
    const late = new Date("2026-11-05T19:50:00Z"); // Tehran 23:20
    expect(quietUntil(late, 22, 8)?.toISOString()).toBe("2026-11-06T04:30:00.000Z"); // Tehran 08:00
    const early = new Date("2026-11-05T01:00:00Z"); // Tehran 04:30
    expect(quietUntil(early, 22, 8)?.toISOString()).toBe("2026-11-05T04:30:00.000Z");
  });
  it("assigns holdout deterministically and close to the requested share", () => {
    expect(holdoutVariant("u1", "welcome", 0)).toBe("treatment");
    expect(holdoutVariant("u1", "welcome", 20)).toBe(holdoutVariant("u1", "welcome", 20));
    const n = Array.from({ length: 2000 }, (_, i) => holdoutVariant(`user${i}`, "welcome", 20)).filter(v => v === "holdout").length;
    expect(n).toBeGreaterThan(300); expect(n).toBeLessThan(500);
  });
  it("uses email only with the channel on, an address and explicit consent; respects suppressions", () => {
    const all = { in_app: true, email: true, push: false };
    expect(chooseChannel({ channels: all, hasEmail: true, marketingConsent: true, suppressed: new Set() })).toBe("email");
    expect(chooseChannel({ channels: all, hasEmail: true, marketingConsent: false, suppressed: new Set() })).toBe("in_app");
    expect(chooseChannel({ channels: all, hasEmail: true, marketingConsent: true, suppressed: new Set(["email"]) })).toBe("in_app");
    expect(chooseChannel({ channels: all, hasEmail: true, marketingConsent: true, suppressed: new Set(["all"]) })).toBeNull();
    expect(chooseChannel({ channels: { in_app: false, email: false, push: false }, hasEmail: true, marketingConsent: true, suppressed: new Set() })).toBeNull();
  });
  it("lists every blocker of real sending, and live planning needs none", () => {
    const f = defaultFollowupSettings(), g = defaultGrowthSettings();
    expect(liveSendBlockers(f, g, "welcome")).toEqual(["engine_disabled", "dry_run_mode", "lifecycle_automation_disabled", "communications_disabled", "no_channel_enabled", "rule_disabled"]);
    expect(planningMode(f, g)).toBeNull();
    const on = { ...f, engine_enabled: true, mode: "live" as const, channels: { ...f.channels, in_app: true } };
    expect(planningMode(on, g)).toBe("dry_run"); // growth flags still off
    const g2 = { ...g, flags: { ...g.flags, lifecycle_automation_enabled: true, automated_communications_enabled: true }, messaging: { ...g.messaging, enabledRules: ["welcome"] } };
    expect(planningMode(on, g2)).toBe("live");
    expect(liveSendBlockers(on, g2, "welcome")).toEqual([]);
    // Scenario modes: welcome is "off" by default, so even a live engine records it at most as a dry run.
    expect(jobModeFor(on, g2, "welcome", "u1")).toBe("dry_run");
    expect(jobModeFor({ ...on, ruleModes: { welcome: "live" } }, g2, "welcome", "u1")).toBe("live");
    expect(jobModeFor({ ...on, ruleModes: { welcome: "internal_test" }, testUserIds: ["staff-1"] }, g2, "welcome", "u1")).toBe("dry_run");
    expect(jobModeFor({ ...on, ruleModes: { welcome: "internal_test" }, testUserIds: ["staff-1"] }, g2, "welcome", "staff-1")).toBe("live");
    expect(jobModeFor({ ...on, ruleModes: { welcome: "live" } }, g, "welcome", "u1")).toBe("dry_run"); // growth flags off
  });
  it("starts only the owner-approved scenarios A, C, G and H, in dry run", () => {
    const f = defaultFollowupSettings();
    expect(f.ruleModes).toEqual({ getting_started_24h: "dry_run", first_result_30m: "dry_run", payment_failed: "dry_run", inactive_3d: "dry_run" });
    expect(plannableRules(f).map(r => r.key)).toEqual(["payment_failed", "first_result_30m", "getting_started_24h", "inactive_3d"]);
    expect(outreachEscalations(f, { ...f, ruleModes: { ...f.ruleModes, payment_failed: "internal_test" } })).toEqual(["rule_payment_failed_internal_test"]);
    expect(outreachEscalations(f, { ...f, testUserIds: ["staff-1"] })).toEqual(["test_users_added"]);
  });
  it("plans every rule in a dry run except the Live rule until its campaign is on, transactional rules first", () => {
    const f = defaultFollowupSettings(), g = defaultGrowthSettings();
    const all = { ...f, ruleModes: Object.fromEntries(RULES.map(r => [r.key, "dry_run" as const])) };
    expect(plannableRules(all).some(r => r.key === "live_first_session")).toBe(false);
    expect(plannableRules({ ...all, live_campaign_enabled: true }).some(r => r.key === "live_first_session")).toBe(true);
    void g;
    expect(orderedRules()[0].key).toBe("payment_failed");
    expect(orderedRules().length).toBe(RULES.length);
    expect(jobKey("dry_run", "welcome:u1")).toBe("dry:welcome:u1");
    expect(jobKey("live", "welcome:u1")).toBe("welcome:u1");
  });
});

describe("messages in four languages", () => {
  const facts: CustomerFacts = { userId: "u1", createdAt: now, plan: "FREE", planExpiry: null, credits: 50, role: "USER", onboardingDone: false, onboardingState: "not_started", successes: {}, failedOperations: 0, creditsUsedWindow: 0, activeDaysWindow: 0, lastActiveAt: null, pricingViewsWindow: 0, demoRequests: 0, checkoutsWindow: 0, payments: { success: 0, failed: 0, pending: 0, revenueToman: 0, firstPaidAt: null, lastFailedAt: null }, unsubscribed: false, marketingConsent: false };
  const user = (language: string) => ({ id: "u1", name: "Sara K", firstName: null, language, plan: "FREE", credits: 50, growthProfile: null });
  const welcome = RULES.find(r => r.key === "welcome")!;
  it("renders fa, en, de and tr; unknown languages fall back to fa", () => {
    const g = defaultGrowthSettings();
    const ctx = ruleContext(user("fa"), facts, g, now);
    expect(ruleMessage(welcome, user("fa"), ctx).title).toBe("به AIFekr خوش آمدید، Sara");
    expect(ruleMessage(welcome, user("en"), ctx).title).toBe("Welcome to AIFekr, Sara");
    expect(ruleMessage(welcome, user("de"), ctx).title).toBe("Willkommen bei AIFekr, Sara");
    expect(ruleMessage(welcome, user("tr"), ctx).title).toBe("AIFekr'e hoş geldiniz, Sara");
    expect(messageLang("xx")).toBe("fa");
  });
  it("uses the admin's English text for de/tr when a rule was customised without de/tr", () => {
    const g = defaultGrowthSettings();
    g.messaging.templates.welcome = { titleFa: "سلام", bodyFa: "متن", titleEn: "Hi {{first_name}}", bodyEn: "Body" };
    expect(ruleMessage(welcome, user("de"), ruleContext(user("de"), facts, g, now)).title).toBe("Hi Sara");
  });
});

describe("AIFekr Live campaign attribution", () => {
  it("builds the tracked /live link and maps /live to the Live module", () => {
    const url = liveCampaignUrl("https://aifekr.com");
    expect(url).toBe("https://aifekr.com/live?utm_source=instagram&utm_medium=comment_dm&utm_campaign=instagram_aifekr_live_launch");
    const t = parseTouch(new URL(url).pathname + new URL(url).search, "https://instagram.com/", ["aifekr.com"])!;
    expect(t.touch).toMatchObject({ utmCampaign: LIVE_CAMPAIGN.utmCampaign, landingPath: "/live", targetModule: "live", referrerHost: "instagram.com" });
    expect(moduleForPath("/en/live")).toBe("live");
  });
  it("lets sign-in return to /live with its UTM", () => {
    expect(safeInternalPath("/live?utm_campaign=instagram_aifekr_live_launch")).toBe("/live?utm_campaign=instagram_aifekr_live_launch");
  });
  it("records server touches only for AIFekr's own host, never a tenant's site", () => {
    expect(isOwnHost(new URL("https://aifekr.com/live"))).toBe(true);
    expect(isOwnHost(new URL("https://www.aifekr.com/live"))).toBe(true);
    expect(isOwnHost(new URL("https://example-shop.com/sale"))).toBe(false);
    expect(isOwnHost(new URL("https://aifekr.com.evil.io/x"))).toBe(false);
  });
});
