import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueOverride = vi.fn();
const findUniqueFlag = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userModuleOverride: { findUnique: (...args: unknown[]) => findUniqueOverride(...args), findMany: vi.fn().mockResolvedValue([]) },
    industryModuleFlag: { findUnique: (...args: unknown[]) => findUniqueFlag(...args), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("isModuleEnabled", () => {
  beforeEach(() => {
    findUniqueOverride.mockReset();
    findUniqueFlag.mockReset();
  });

  it("1. platform admin is always enabled, bypassing overrides and pack flags entirely", async () => {
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "ADMIN", industryPackId: null }, "crm.property");
    expect(enabled).toBe(true);
    expect(findUniqueOverride).not.toHaveBeenCalled();
    expect(findUniqueFlag).not.toHaveBeenCalled();
  });

  it("also treats SUPER_ADMIN as platform admin", async () => {
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "SUPER_ADMIN", industryPackId: null }, "crm.property");
    expect(enabled).toBe(true);
  });

  it("2. a per-customer override is authoritative when present", async () => {
    findUniqueOverride.mockResolvedValue({ enabled: true });
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: "pack1" }, "crm.property");
    expect(enabled).toBe(true);
    expect(findUniqueFlag).not.toHaveBeenCalled();
  });

  it("override wins over pack default even when pack says disabled (explicit edge case from spec)", async () => {
    findUniqueOverride.mockResolvedValue({ enabled: true });
    findUniqueFlag.mockResolvedValue({ enabled: false });
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: "pack1" }, "crm.property");
    expect(enabled).toBe(true);
  });

  it("override wins over pack default even when pack says enabled but override disables it", async () => {
    findUniqueOverride.mockResolvedValue({ enabled: false });
    findUniqueFlag.mockResolvedValue({ enabled: true });
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: "pack1" }, "crm.property");
    expect(enabled).toBe(false);
  });

  it("3. falls back to the pack-level flag when no override exists", async () => {
    findUniqueOverride.mockResolvedValue(null);
    findUniqueFlag.mockResolvedValue({ enabled: true });
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: "pack1" }, "crm.property");
    expect(enabled).toBe(true);
  });

  it("4a. no industry pack at all -> disabled (fail-safe hidden)", async () => {
    findUniqueOverride.mockResolvedValue(null);
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: null }, "crm.property");
    expect(enabled).toBe(false);
    expect(findUniqueFlag).not.toHaveBeenCalled();
  });

  it("4b. pack has no matching flag row -> disabled (fail-safe hidden, never fail-open)", async () => {
    findUniqueOverride.mockResolvedValue(null);
    findUniqueFlag.mockResolvedValue(null);
    const { isModuleEnabled } = await import("./moduleAccess");
    const enabled = await isModuleEnabled({ id: "u1", role: "USER", industryPackId: "pack1" }, "crm.property");
    expect(enabled).toBe(false);
  });
});
