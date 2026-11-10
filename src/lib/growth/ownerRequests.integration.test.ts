import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/jwt";
import { shellGate } from "@/lib/layout/platformShellData";
import { PHONE_REQUIREMENT_KEY, clearPhoneRequirementCache, mustCompletePhone, savePhoneRequirement } from "@/lib/auth/phoneRequirement";
import { POST as savePhone } from "@/app/api/account/phone/route";
import { POST as register } from "@/app/api/auth/register/route";
import { campaignPack, packDailyCsv, packMarkdown, packSummaryCsv, touchKey, weekKey } from "./campaignPack";
import { phoneExportCsv, phoneExportRows, toE164 } from "./phoneExport";

/** Owner requests of 2026-11-06: mandatory mobile number, campaign AI pack, SMS export. Real test DB; nothing is sent anywhere. */
const ACTOR = `owner-req-admin-${Date.now()}`;
const tag = `ownerreq${Date.now()}`;
const made: string[] = [];
let before: string | null = null;
const rnd = () => Math.floor(Math.random() * 1e8).toString().padStart(8, "0");
async function user(data: { phone?: string | null; role?: string; name?: string; email?: string; createdAt?: Date } = {}) {
  const u = await prisma.user.create({ data: { name: data.name ?? "Owner Req", role: data.role ?? "USER", phone: data.phone === undefined ? `091${rnd()}` : data.phone, email: data.email ?? null, onboardingDone: true, createdAt: data.createdAt } });
  made.push(u.id);
  return u;
}
const req = (url: string, body: unknown, userId?: string, role = "USER") => new NextRequest(url, { method: "POST", headers: { "Content-Type": "application/json", ...(userId ? { cookie: `token=${signToken({ userId, role, plan: "FREE" })}` } : {}) }, body: JSON.stringify(body) });

beforeAll(async () => { before = (await prisma.siteSetting.findUnique({ where: { key: PHONE_REQUIREMENT_KEY } }))?.value ?? null; });
beforeEach(async () => { await prisma.siteSetting.deleteMany({ where: { key: PHONE_REQUIREMENT_KEY } }); clearPhoneRequirementCache(); });
afterAll(async () => {
  if (before) await prisma.siteSetting.upsert({ where: { key: PHONE_REQUIREMENT_KEY }, create: { key: PHONE_REQUIREMENT_KEY, value: before }, update: { value: before } });
  else await prisma.siteSetting.deleteMany({ where: { key: PHONE_REQUIREMENT_KEY } });
  await prisma.growthTouch.deleteMany({ where: { utmCampaign: tag } });
  await prisma.auditLog.deleteMany({ where: { actorId: ACTOR } });
  await prisma.user.deleteMany({ where: { id: { in: made } } });
});

describe("mandatory mobile number", () => {
  it("rule: only non-admin users without a number, only while the switch is on", () => {
    expect(mustCompletePhone({ phone: null, role: "USER" }, true)).toBe(true);
    expect(mustCompletePhone({ phone: "09120000000", role: "USER" }, true)).toBe(false);
    expect(mustCompletePhone({ phone: null, role: "SUPER_ADMIN" }, true)).toBe(false);
    expect(mustCompletePhone({ phone: null, role: "ADMIN" }, true)).toBe(false);
    expect(mustCompletePhone({ phone: null, role: "USER" }, false)).toBe(false);
  });

  it("the shell sends a user without a number to /complete-phone (keeping the page), never an admin; off = no gate", async () => {
    const u = await user({ phone: null }), admin = await user({ phone: null, role: "SUPER_ADMIN" });
    const gate = await shellGate(signToken({ userId: u.id, role: "USER", plan: "FREE" }), "/live?utm_campaign=x");
    expect(gate).toEqual({ kind: "redirect", to: "/complete-phone?redirect=%2Flive%3Futm_campaign%3Dx" });
    expect((await shellGate(signToken({ userId: u.id, role: "USER", plan: "FREE" }), "/complete-phone")).kind).toBe("full");
    expect((await shellGate(signToken({ userId: admin.id, role: "SUPER_ADMIN", plan: "FREE" }), "/home")).kind).toBe("full");
    await savePhoneRequirement(false, ACTOR);
    expect((await shellGate(signToken({ userId: u.id, role: "USER", plan: "FREE" }), "/home")).kind).toBe("full");
  });

  it("a brand-new account (onboarding not done, no number) reaches /complete-phone instead of looping via /welcome", async () => {
    const u = await user({ phone: null });
    await prisma.user.update({ where: { id: u.id }, data: { onboardingDone: false } });
    const token = signToken({ userId: u.id, role: "USER", plan: "FREE" });
    expect(await shellGate(token, "/welcome")).toEqual({ kind: "redirect", to: "/complete-phone" });
    expect((await shellGate(token, "/complete-phone")).kind).toBe("full");
    // After the number is saved, onboarding comes next as before.
    await prisma.user.update({ where: { id: u.id }, data: { phone: `091${rnd()}` } });
    expect(await shellGate(token, "/home")).toEqual({ kind: "redirect", to: "/welcome" });
    expect((await shellGate(token, "/welcome")).kind).toBe("full");
    // The new-design wizard must not bounce back to /welcome (that looped /welcome ↔ /welcome/setup).
    expect((await shellGate(token, "/welcome/setup")).kind).toBe("full");
    // A buyer from a buy button reaches the packages without the onboarding wizard.
    expect((await shellGate(token, "/plans?category=STUDENT")).kind).toBe("full");
  });

  it("saves a valid, unique number once, normalised like registration", async () => {
    const u = await user({ phone: null }), other = await user({ phone: `091${rnd()}` });
    const bad = await savePhone(req("http://localhost/api/account/phone", { country: "IR", phone: "123", lang: "en" }, u.id));
    expect(bad.status).toBe(400);
    const taken = await savePhone(req("http://localhost/api/account/phone", { country: "IR", phone: other.phone!.slice(1), lang: "de" }, u.id));
    expect(taken.status).toBe(409);
    expect((await taken.json()).error).toContain("Handynummer");
    const mine = `9${rnd().slice(0, 9).padEnd(9, "1")}`;
    const ok = await savePhone(req("http://localhost/api/account/phone", { country: "IR", phone: `+98${mine}`, redirect: "/live?utm_campaign=x", lang: "fa" }, u.id));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, redirect: "/live?utm_campaign=x" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).phone).toBe(`0${mine}`);
    // Never overwritten by a second call.
    await savePhone(req("http://localhost/api/account/phone", { country: "IR", phone: "9129999999", lang: "fa" }, u.id));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).phone).toBe(`0${mine}`);
    expect((await savePhone(req("http://localhost/api/account/phone", { country: "IR", phone: "9120000000" }))).status).toBe(401);
  });

  it("registration without a number is refused while the switch is on, in the form's language", async () => {
    const r = await register(req("http://localhost/api/auth/register", { firstName: "No", email: `${tag}@example.invalid`, password: "test-only-pass-1", language: "tr", country: "TR" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "PHONE_REQUIRED", error: "Cep telefonu numarası gerekli" });
  });
});

describe("campaign AI analysis pack", () => {
  it("helpers: attribution key and ISO week", () => {
    expect(touchKey({ utmCampaign: "c1", utmSource: "instagram", referrerHost: null })).toBe("c1");
    expect(touchKey({ utmCampaign: null, utmSource: null, referrerHost: "google.com" })).toBe("ref:google.com");
    expect(touchKey(null)).toBe("unknown");
    expect(weekKey(new Date("2026-11-06T10:00:00Z"))).toBe("2026-11-02");
  });

  it("aggregates the funnel, timing, revenue and credits per campaign with no personal data", async () => {
    const name = `Secret Person ${tag}`, email = `${tag}-buyer@example.invalid`;
    const signup = new Date(Date.now() - 2 * 86_400_000);
    const u = await user({ name, email, createdAt: signup });
    const touch = await prisma.growthTouch.create({ data: { anonId: `${tag}-anon-1`, userId: u.id, utmCampaign: tag, utmSource: "instagram", utmMedium: "comment_dm", landingPath: "/live", createdAt: new Date(signup.getTime() - 3_600_000) } });
    await prisma.growthTouch.create({ data: { anonId: `${tag}-anon-2`, utmCampaign: tag, utmSource: "instagram", utmMedium: "comment_dm", landingPath: "/live" } });
    await prisma.growthProfile.create({ data: { userId: u.id, firstTouchId: touch.id } });
    await prisma.generatedImage.create({ data: { userId: u.id, prompt: "PRIVATE PROMPT TEXT", url: "https://example.invalid/a.png", createdAt: new Date(signup.getTime() + 2 * 3_600_000) } });
    await prisma.payment.create({ data: { userId: u.id, amount: 199000, plan: "CHAT_ECO_30", status: "SUCCESS", createdAt: new Date(signup.getTime() + 10 * 3_600_000) } });
    const pack = await campaignPack({ from: new Date(Date.now() - 7 * 86_400_000), to: new Date() }, tag);
    const b = pack.campaigns[0];
    expect(b.key).toBe(tag);
    expect(b.funnel).toMatchObject({ visits: 2, visitors: 2, signups: 1, signupRate: 50, activated: 1, activationRate: 100, buyers: 1, purchaseRate: 100 });
    expect(b.timing).toMatchObject({ hoursToFirstValueMedian: 2, hoursToPurchaseMedian: 10 });
    expect(b.revenue).toMatchObject({ revenueToman: 199000, payments: 1 });
    expect(b.moduleUsers).toEqual({ image: 1 });
    expect(b.daily.reduce((n, d) => n + d.signups, 0)).toBe(1);
    const all = JSON.stringify(pack) + packMarkdown(pack) + packSummaryCsv(pack) + packDailyCsv(pack);
    for (const secret of [name, email, u.id, u.phone!, "PRIVATE PROMPT TEXT", `${tag}-anon-1`]) expect(all).not.toContain(secret);
    expect(packMarkdown(pack)).toContain("## Definitions");
    expect(pack.definitions.activationRate).toContain("Denominator");
  });
});

describe("SMS phone export", () => {
  it("converts stored numbers to E.164", () => {
    expect(toE164("09121234567")).toBe("+989121234567");
    expect(toE164("+491701234567")).toBe("+491701234567");
    expect(toE164("12345")).toBeNull();
  });

  it("defaults to people who have not opted out; consented and all are explicit choices", async () => {
    const yes = await user(), no = await user(), out = await user();
    await prisma.growthProfile.create({ data: { userId: yes.id, marketingConsent: true } });
    await prisma.growthProfile.create({ data: { userId: out.id, unsubscribedAt: new Date(), consentSource: "unsubscribe_link" } });
    const has = (r: Awaited<ReturnType<typeof phoneExportRows>>, phone: string) => r.rows.some(x => x.cols[1] === toE164(phone));
    const def = await phoneExportRows("not_opted_out");
    expect([has(def, yes.phone!), has(def, no.phone!), has(def, out.phone!)]).toEqual([true, true, false]);
    const consented = await phoneExportRows("consented");
    expect([has(consented, yes.phone!), has(consented, no.phone!), has(consented, out.phone!)]).toEqual([true, false, false]);
    const everyone = await phoneExportRows("all");
    expect(has(everyone, out.phone!)).toBe(true);
    const csv = phoneExportCsv(def.rows);
    expect(csv.split("\n")[0]).toBe("﻿name,phone_e164,language,registered_at,lifecycle_stage,plan,last_active,marketing_consent,opted_out,opt_out_source");
  });
});
