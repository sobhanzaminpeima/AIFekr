import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSetting: vi.fn(),
  findOverride: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    siteSetting: { findUnique: mocks.findSetting },
    userModuleOverride: { findUnique: mocks.findOverride },
  },
}));

import { isStudentWorkspaceEnabled, studentWorkspaceDisabledResponse } from "./access";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findSetting.mockResolvedValue({ value: "true" });
  mocks.findOverride.mockResolvedValue(null);
});

describe("student workspace access", () => {
  it("uses the enabled-by-default site setting when a user has no override", async () => {
    expect(await isStudentWorkspaceEnabled({ id: "student-1" })).toBe(true);
    expect(mocks.findOverride).toHaveBeenCalledWith({
      where: { userId_moduleKey: { userId: "student-1", moduleKey: "student.workspace" } },
      select: { enabled: true },
    });
  });

  it("allows an explicit per-user enable even when the global default is off", async () => {
    mocks.findSetting.mockResolvedValue({ value: "false" });
    mocks.findOverride.mockResolvedValue({ enabled: true });
    expect(await isStudentWorkspaceEnabled({ id: "student-1" })).toBe(true);
    expect(mocks.findSetting).not.toHaveBeenCalled();
  });

  it("allows an explicit per-user disable even when the global default is on", async () => {
    mocks.findOverride.mockResolvedValue({ enabled: false });
    expect(await isStudentWorkspaceEnabled({ id: "student-1" })).toBe(false);
    const response = await studentWorkspaceDisabledResponse({ id: "student-1" });
    expect(response?.status).toBe(503);
  });

  it("falls back to the global default for an unconfigured user", async () => {
    mocks.findSetting.mockResolvedValue({ value: "false" });
    expect(await isStudentWorkspaceEnabled({ id: "student-1" })).toBe(false);
    expect(await isStudentWorkspaceEnabled()).toBe(false);
  });
});
