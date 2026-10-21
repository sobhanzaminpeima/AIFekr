import { describe, it, expect, beforeAll } from "vitest";
import { createGscState, verifyGscState } from "./gscState";

beforeAll(() => { process.env.JWT_SECRET ||= "test-secret"; });

describe("GSC OAuth state", () => {
  it("round-trips the user id it was issued to", () => {
    expect(verifyGscState(createGscState("user-1"))).toBe("user-1");
  });

  it("rejects a bare user id (the old, forgeable format)", () => {
    expect(verifyGscState("user-1")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, sig] = createGscState("user-1").split(".");
    const forged = Buffer.from(JSON.stringify({ u: "victim", e: Date.now() + 60_000 })).toString("base64url");
    expect(verifyGscState(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects an expired state", () => {
    const state = createGscState("user-1", Date.now() - 11 * 60 * 1000);
    expect(verifyGscState(state)).toBeNull();
  });

  it("rejects empty input", () => {
    expect(verifyGscState(null)).toBeNull();
    expect(verifyGscState("")).toBeNull();
  });
});
