import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  upsert: vi.fn(), userUpdate: vi.fn(), track: vi.fn(async () => true), dismissed: null as { id: string } | null,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    growthProfile: {
      findUnique: vi.fn(async () => mocks.profile),
      upsert: vi.fn(async (a: { create: Record<string, unknown>; update: Record<string, unknown> }) => { mocks.upsert(a); mocks.profile = { ...(mocks.profile ?? a.create), ...a.update }; }),
    },
    user: { update: mocks.userUpdate },
    moduleRegistry: { findMany: vi.fn(async () => [{ key: "video" }]) },
    growthEvent: { findFirst: vi.fn(async () => mocks.dismissed) },
  },
}));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: vi.fn(async () => ({ id: "u1", credits: 50, accountType: "PERSONAL" })), unauthorizedResponse: vi.fn() }));
vi.mock("@/lib/growth/config", () => ({ growthFlag: vi.fn(async () => true) }));
vi.mock("@/lib/growth/events", () => ({ trackEvent: mocks.track }));

import { GROWTH_MODULES, parseGoals, recommendModules } from "./modules";
import { personalizeInvite } from "./onboarding";
import { POST } from "@/app/api/growth/onboarding/route";

const post = (data: unknown) => POST(new NextRequest("http://localhost/api/growth/onboarding", { method: "POST", body: JSON.stringify(data) }));
const tracked = () => mocks.track.mock.calls.map((c) => (c as unknown as [{ name: string }])[0].name);

beforeEach(() => { mocks.profile = null; mocks.dismissed = null; mocks.upsert.mockClear(); mocks.userUpdate.mockClear(); mocks.track.mockClear(); });

describe("goals", () => {
  it("keeps known goals in order without repeats", () => {
    expect(parseGoals("crm,nope,media,crm")).toEqual(["crm", "media"]);
    expect(parseGoals(null)).toEqual([]);
  });
  it("suggests one module per goal first, primary goal first", () => {
    const ids = recommendModules(["education", "crm"], () => true).map((m) => m.id);
    expect(ids.slice(0, 2)).toEqual(["student", "crm"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("never suggests a module that is not available", () => {
    const ids = recommendModules(["media"], (m) => m.id !== "image").map((m) => m.id);
    expect(ids).not.toContain("image");
    expect(recommendModules([], (m) => m.id === "chat").map((m) => m.id)).toEqual(["chat"]);
  });
});

describe("onboarding answers", () => {
  it("saves several goals with the first as the primary objective", async () => {
    await post({ action: "save", step: 2, goals: ["crm", "bogus", "media"] });
    expect(mocks.profile).toMatchObject({ goals: "crm,media", objective: "crm", onboardingState: "in_progress" });
  });
  it("completes into the chosen suggestion, never into a disabled module", async () => {
    mocks.profile = { goals: "media", objective: "media", onboardingState: "in_progress" };
    expect(await (await post({ action: "complete", module: "music" })).json()).toMatchObject({ redirect: "/music" });
    mocks.profile = { goals: "media", objective: "media", onboardingState: "in_progress" };
    // "video" is disabled in the registry above.
    expect((await (await post({ action: "complete", module: "video" })).json()).redirect).not.toBe("/video");
  });
  it("skipping leaves for home and never blocks", async () => {
    expect(await (await post({ action: "skip" })).json()).toMatchObject({ redirect: "/home" });
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { onboardingDone: true } });
    expect(tracked()).toContain("onboarding_skipped");
  });
  it("editing a finished onboarding keeps it finished", async () => {
    mocks.profile = { goals: "crm", objective: "crm", onboardingState: "completed" };
    await post({ action: "save", step: 1, goals: ["fitness"] });
    await post({ action: "skip" });
    expect(mocks.profile).toMatchObject({ goals: "fitness", objective: "fitness", onboardingState: "completed" });
    expect(tracked()).not.toContain("onboarding_skipped");
  });
  it("the classic wizard's single objective still works", async () => {
    await post({ action: "save", step: 1, objective: "seo" });
    expect(mocks.profile).toMatchObject({ goals: "seo", objective: "seo" });
  });
});

describe("home invitation", () => {
  const user = { id: "u1", accountType: "PERSONAL" };
  it("is offered only without goals, and stops after 'no thanks' or completion", async () => {
    expect(await personalizeInvite(user)).toBe(true);
    mocks.profile = { goals: "crm", objective: "crm", onboardingState: "skipped" };
    expect(await personalizeInvite(user)).toBe(false);
    mocks.profile = { goals: "", objective: null, onboardingState: "completed" };
    expect(await personalizeInvite(user)).toBe(false);
    mocks.profile = null; mocks.dismissed = { id: "e1" };
    expect(await personalizeInvite(user)).toBe(false);
  });
  it("is not offered to accounts that use the established wizard", async () => {
    expect(await personalizeInvite({ id: "u1", accountType: "STUDENT" })).toBe(false);
  });
  it("records 'no thanks' once", async () => {
    await post({ action: "dismiss_invite" });
    expect(mocks.track).toHaveBeenCalledWith(expect.objectContaining({ name: "onboarding_invite_dismissed", idempotencyKey: "onb:invite_dismissed:u1" }));
  });
});

it("every growth module has a page", () => {
  expect(GROWTH_MODULES.every((m) => m.paths[0].startsWith("/"))).toBe(true);
});
