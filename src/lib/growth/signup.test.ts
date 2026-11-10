import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("./config", () => ({ growthFlag: vi.fn(async () => false) }));
vi.mock("./events", () => ({ linkSignup: vi.fn(async () => undefined), trackEvent: vi.fn(async () => undefined) }));

import { onAccountCreated } from "./signup";

describe("onAccountCreated return path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the package a visitor chose before signing up", async () => {
    const path = "/plans?plan=STUDENT_MONTHLY&period=monthly";
    expect(await onAccountCreated("u1", null, path)).toBe(path);
  });
  it("does not follow an external address", async () => {
    expect(await onAccountCreated("u1", null, "//evil.example/plans")).toBeNull();
  });
  it("sends everyone else through the normal welcome", async () => {
    expect(await onAccountCreated("u1", null, undefined)).toBeNull();
  });
});
