import { describe, expect, it } from "vitest";
import { moduleForPath, parseTouch, safeInternalPath } from "./attribution";
import { defaultGrowthSettings } from "./config";
import { CLIENT_EVENTS, sanitizeMetadata } from "./events";
import { bandFor, evaluate, scoreFor, segmentsFor, stageFor, type CustomerFacts } from "./lifecycle";
import { RULES, inQuietHours, renderTemplate, validateTemplate } from "./automation";
import { grantedPlan, pickRecommendation, type PackageRow } from "./upgrade";
import { csvEscape } from "./analytics";
import { effectivePolicy, settingsSchema, trialRemaining } from "@/lib/voice-studio/domain";

const own = ["aifekr.com", "localhost"];
const now = new Date("2026-10-28T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const facts = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  userId: "u1", createdAt: daysAgo(10), plan: "FREE", planExpiry: null, credits: 200, role: "USER", onboardingDone: false, onboardingState: "not_started",
  successes: {}, failedOperations: 0, creditsUsedWindow: 0, activeDaysWindow: 0, lastActiveAt: daysAgo(1), pricingViewsWindow: 0, demoRequests: 0, checkoutsWindow: 0,
  payments: { success: 0, failed: 0, pending: 0, revenueToman: 0, firstPaidAt: null, lastFailedAt: null }, unsubscribed: false, marketingConsent: false, ...over,
});

describe("attribution", () => {
  it("keeps UTM values and only the external referrer host", () => {
    const r = parseTouch("/voice-studio?utm_source=Instagram&utm_medium=paid_social&utm_campaign=voice_studio_launch&x=1", "https://l.instagram.com/some/path?q=secret", own)!;
    expect(r.confidence).toBe("utm");
    expect(r.touch).toMatchObject({ utmSource: "instagram", utmMedium: "paid_social", utmCampaign: "voice_studio_launch", referrerHost: "l.instagram.com", landingPath: "/voice-studio", targetModule: "voice-studio" });
  });
  it("records a referrer touch, ignores same-site referrers and direct visits", () => {
    expect(parseTouch("/", "https://www.google.com/", own)?.confidence).toBe("referrer");
    expect(parseTouch("/pricing", "https://aifekr.com/features/crm", own)).toBeNull();
    expect(parseTouch("/", null, own)).toBeNull();
  });
  it("maps landing pages and app routes to modules", () => {
    expect(moduleForPath("/features/voice-studio")).toBe("voice-studio");
    expect(moduleForPath("/en/features/crm")).toBe("crm");
    expect(moduleForPath("/image/generate")).toBe("image");
    expect(moduleForPath("/pricing")).toBeNull();
  });
  it("allows only same-site product paths as a return destination", () => {
    expect(safeInternalPath("/voice-studio?project=abc")).toBe("/voice-studio?project=abc");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/voice-studio\u0000", "javascript:alert(1)", "/random-page", "/%2F%2Fevil.com"]) expect(safeInternalPath(bad)).toBeNull();
  });
});

describe("events", () => {
  it("never accepts financial or success events from the browser", () => {
    for (const name of ["payment_succeeded", "checkout_started", "credits_consumed", "first_value_achieved", "ai_generation_succeeded", "subscription_activated"]) expect(CLIENT_EVENTS.has(name)).toBe(false);
  });
  it("keeps metadata small and flat", () => {
    const out = JSON.parse(sanitizeMetadata({ ok: 1, "bad key": 2, long: "x".repeat(500), nested: null }));
    expect(out).toEqual({ ok: 1, long: "x".repeat(120), nested: null });
  });
});

describe("lifecycle, scoring and segments", () => {
  const s = defaultGrowthSettings();
  it("does not count onboarding clicks as first value", () => {
    const f = facts({ onboardingDone: true, onboardingState: "completed" });
    expect(stageFor(f, s, now)).toBe("onboarding");
    expect(segmentsFor(f, s, now, 0)).toContain("unactivated");
  });
  it("moves from activated to engaged to purchase intent on real evidence", () => {
    const fv = { image: { count: 1, first: daysAgo(5) } };
    expect(stageFor(facts({ successes: fv }), s, now)).toBe("activated");
    expect(stageFor(facts({ successes: fv, activeDaysWindow: 3 }), s, now)).toBe("engaged");
    expect(stageFor(facts({ successes: fv, checkoutsWindow: 1 }), s, now)).toBe("purchase_intent");
  });
  it("treats only server-confirmed payments with an active plan as paying", () => {
    const paid = facts({ plan: "PRO", planExpiry: daysAgo(-20), payments: { success: 1, failed: 0, pending: 0, revenueToman: 350000, firstPaidAt: daysAgo(10), lastFailedAt: null }, activeDaysWindow: 5 });
    expect(stageFor(paid, s, now)).toBe("paid");
    expect(stageFor({ ...paid, payments: { ...paid.payments, success: 0 } }, s, now)).not.toBe("paid");
    expect(stageFor({ ...paid, planExpiry: daysAgo(1) }, s, now)).toBe("churned");
    expect(stageFor({ ...paid, lastActiveAt: daysAgo(20) }, s, now)).toBe("at_risk");
  });
  it("scores each rule once, normalised to 0-100 with an explanation", () => {
    const f = facts({ onboardingState: "completed", successes: { image: { count: 9, first: daysAgo(5) } }, activeDaysWindow: 4, pricingViewsWindow: 7, checkoutsWindow: 3, demoRequests: 2 });
    const r = scoreFor(f, s);
    expect(r.score).toBe(100);
    expect(r.lines).toHaveLength(7);
    expect(scoreFor(facts(), s).score).toBe(0);
    expect(bandFor(39, s)).toBe("activation"); expect(bandFor(40, s)).toBe("nurture"); expect(bandFor(80, s)).toBe("sales");
  });
  it("uses configurable thresholds", () => {
    const custom = { ...s, thresholds: { ...s.thresholds, lowCredits: 500 } };
    expect(segmentsFor(facts(), custom, now, 0)).toContain("low_credit");
    expect(segmentsFor(facts(), s, now, 0)).not.toContain("low_credit");
    expect(evaluate(facts(), s, now).firstValueAt).toBeNull();
  });
});

describe("lifecycle messages", () => {
  const vars = { first_name: "<b>Sara</b>", preferred_module: "Voice Studio", current_plan: "FREE", credit_balance: "200", recommended_next_step: "x", pricing_url: "https://aifekr.com/pricing" };
  it("renders only known variables as plain text", () => {
    expect(renderTemplate("Hi {{first_name}} — {{credit_balance}}", vars)).toBe("Hi bSara/b — 200");
    expect(() => renderTemplate("{{password}}", vars)).toThrow("UNKNOWN_VARIABLE");
    expect(() => validateTemplate({ titleFa: "{{user.email}}", bodyFa: "", titleEn: "", bodyEn: "" })).toThrow();
    for (const r of RULES) expect(() => validateTemplate(r.template)).not.toThrow();
  });
  it("applies Tehran quiet hours", () => {
    expect(inQuietHours(new Date("2026-10-28T19:00:00Z"), 22, 8)).toBe(true); // 22:30 Tehran
    expect(inQuietHours(new Date("2026-10-28T08:00:00Z"), 22, 8)).toBe(false); // 11:30 Tehran
  });
  it("never targets paying users with promotional rules", () => {
    const s = defaultGrowthSettings();
    const paidCtx = { f: facts({ createdAt: daysAgo(12), credits: 0, successes: { image: { count: 5, first: daysAgo(9) } }, activeDaysWindow: 9 }), ev: { segments: ["engaged_free"], score: 99, firstValueAt: daysAgo(9) }, s, now, intendedModule: null, ageDays: 12, paid: true };
    for (const r of RULES.filter(x => x.kind === "promotional")) expect(r.eligible(paidCtx as never)).toBe(false);
  });
});

describe("upgrade recommendation", () => {
  const rows: PackageRow[] = [
    { planCode: "BASIC", name: "پایه", nameEn: "Basic", price: 1500000, priceUsd: null, market: "IR", duration: 30, credits: 2000, category: "PERSONAL" },
    { planCode: "PRO", name: "حرفه‌ای", nameEn: "Pro", price: 3500000, priceUsd: null, market: "IR", duration: 30, credits: 6000, category: "PERSONAL" },
    { planCode: "TEAM_STARTER", name: "استارتاپ", nameEn: "Startup", price: 39000000, priceUsd: 14900, market: "BOTH", duration: 30, credits: 4000, category: "PERSONAL" },
    { planCode: "CRM_SOLO", name: "CRM", nameEn: "CRM", price: 6900000, priceUsd: 2900, market: "BOTH", duration: 30, credits: 0, category: "PERSONAL" },
  ];
  it("maps packages to the plan they grant", () => { expect(grantedPlan("TEAM_STARTER")).toBe("TEAM"); expect(grantedPlan("CRM_SOLO")).toBeNull(); });
  it("picks the cheapest real package that unlocks the module, with its exact price", () => {
    const r = pickRecommendation(rows, { moduleId: "voice-studio", currentPlan: "FREE", iran: true, allowedPlans: ["PRO", "TEAM"], minPlan: "FREE", returnTo: "/voice-studio" })!;
    expect(r).toMatchObject({ planCode: "PRO", priceToman: 350000, credits: 6000 });
    expect(r.checkoutUrl).toBe("/plans?plan=PRO&period=monthly&returnTo=%2Fvoice-studio");
  });
  it("returns nothing rather than inventing a plan", () => {
    expect(pickRecommendation(rows, { moduleId: "voice-studio", currentPlan: "FREE", iran: false, allowedPlans: ["PRO"], minPlan: "FREE", returnTo: "/voice-studio" })).toBeNull();
    expect(pickRecommendation(rows, { moduleId: "image", currentPlan: "TEAM", iran: true, allowedPlans: null, minPlan: "FREE", returnTo: "/image" })).toBeNull();
  });
});

describe("voice studio trial", () => {
  const policy = settingsSchema.parse({ trialGenerations: 1, trialMaxSeconds: 30 });
  it("is off by default and never applies to allowed plans", () => {
    expect(settingsSchema.parse({}).trialGenerations).toBe(0);
    expect(trialRemaining(true, policy, 0)).toBe(0);
    expect(trialRemaining(false, policy, 0)).toBe(1);
    expect(trialRemaining(false, policy, 1)).toBe(0);
  });
  it("caps a trial sample's duration for splitting, reservation and validation", () => {
    expect(effectivePolicy(policy, true).maxDurationSeconds).toBe(30);
    expect(effectivePolicy(policy, false).maxDurationSeconds).toBe(60);
  });
});

describe("csv export", () => {
  it("neutralises spreadsheet formulas", () => { expect(csvEscape("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`); expect(csvEscape('a"b')).toBe('"a""b"'); });
});
