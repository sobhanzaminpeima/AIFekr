import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), trainer: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { fitnessProfile: { findUnique: m.find, update: m.update }, fitnessTrainer: { findFirstOrThrow: m.trainer }, fitnessProgram: { findFirstOrThrow: vi.fn() } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1", role: "USER" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => "fa" }));
vi.mock("@/lib/fitness/service", () => ({ fitnessAccess: async () => true, startSession: vi.fn(), syncSession: vi.fn() }));
vi.mock("@/lib/fitness/required", () => ({ fitnessRequired: vi.fn() }));
import { POST } from "./route";

const choose = () => POST(new NextRequest("http://localhost/api/fitness", { method: "POST", body: JSON.stringify({ action: "preferences", coachId: "coach1" }) }));
beforeEach(() => { vi.clearAllMocks(); m.trainer.mockResolvedValue({ id: "coach1" }); });

describe("POST /api/fitness preferences", () => {
  it("asks for the profile first instead of showing a database error", async () => {
    m.find.mockResolvedValue(null);
    const res = await choose();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("FITNESS_PROFILE_REQUIRED");
    expect(body.error).toContain("پروفایل");
    expect(JSON.stringify(body)).not.toMatch(/prisma|invocation/i);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("saves the coach on an existing profile", async () => {
    m.find.mockResolvedValue({ userId: "u1" });
    m.update.mockResolvedValue({});
    const res = await choose();
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0][0]).toEqual({ where: { userId: "u1" }, data: { selectedCoachId: "coach1" } });
  });

  it("never returns a raw Prisma message", async () => {
    m.find.mockResolvedValue({ userId: "u1" });
    m.update.mockRejectedValue(new Error("Invalid `prisma.fitnessProfile.update()` invocation: Record to update not found."));
    const body = await (await choose()).json();
    expect(JSON.stringify(body)).not.toMatch(/prisma|invocation|Record to update/i);
    expect(body.error).toBeTruthy();
  });
});
