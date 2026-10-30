import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  successes: {} as Record<string, unknown>,
  events: [] as { moduleId: string; createdAt: Date }[],
  blocked: [] as { key: string }[],
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    growthProfile: { findUnique: vi.fn(async () => mocks.profile) },
    growthEvent: { findMany: vi.fn(async () => mocks.events), findFirst: vi.fn(async () => null) },
    moduleRegistry: { findMany: vi.fn(async () => mocks.blocked) },
  },
}));
vi.mock("./facts", () => ({ loadFacts: vi.fn(async () => new Map([["u1", { successes: mocks.successes }]])) }));
vi.mock("./config", () => ({ growthFlag: vi.fn(async () => true) }));

import { homeWorkspace } from "./workspace";

const user = { id: "u1", accountType: "PERSONAL" };
const all = { student: true, fitness: true };
beforeEach(() => { mocks.profile = null; mocks.successes = {}; mocks.events = []; mocks.blocked = []; });

describe("home workspace", () => {
  it("without goals: no suggestions, the invitation instead, nothing invented", async () => {
    const w = await homeWorkspace(user, all, "en");
    expect(w).toMatchObject({ goals: [], invite: true, primary: null, tools: [], recentModules: [] });
  });
  it("suggests the goals' tools with their benefit, and a first step on a real page", async () => {
    mocks.profile = { goals: "crm,media", objective: "crm" };
    const w = await homeWorkspace(user, all, "en");
    expect(w.tools[0]).toMatchObject({ id: "crm", href: "/crm", benefit: "Organize customers and follow up on sales opportunities" });
    expect(w.tools.length).toBeGreaterThanOrEqual(3);
    expect(w.tools.every((t) => !["/image", "/video", "/music"].includes(t.href))).toBe(true);
    expect(w.primary).toMatchObject({ id: "crm", title: "Add three of your current customers", cta: "Get started" });
  });
  it("moves the next step on once a tool has a real result", async () => {
    mocks.profile = { goals: "crm,media", objective: "crm" };
    mocks.successes = { crm: { count: 2, first: new Date() } };
    expect((await homeWorkspace(user, all, "en")).primary?.id).not.toBe("crm");
  });
  it("never suggests a switched-off or unreachable module", async () => {
    mocks.profile = { goals: "education,media", objective: "education" };
    mocks.blocked = [{ key: "image" }];
    const w = await homeWorkspace(user, { student: false, fitness: false }, "en");
    expect(w.tools.map((t) => t.id)).not.toContain("student");
    expect(w.tools.map((t) => t.id)).not.toContain("image");
  });
  it("lists recently opened tools once each, latest first", async () => {
    mocks.events = [
      { moduleId: "voice-studio", createdAt: new Date("2026-10-30T10:00:00Z") },
      { moduleId: "crm", createdAt: new Date("2026-10-29T10:00:00Z") },
      { moduleId: "voice-studio", createdAt: new Date("2026-10-28T10:00:00Z") },
      { moduleId: "unknown", createdAt: new Date("2026-10-27T10:00:00Z") },
    ];
    expect((await homeWorkspace(user, all, "fa")).recentModules.map((m) => m.id)).toEqual(["voice-studio", "crm"]);
  });
});
