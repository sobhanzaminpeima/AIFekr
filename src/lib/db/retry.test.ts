import { describe, expect, it } from "vitest";
import { isDbBusy, withDbRetry } from "./retry";

const busy = (code: string) => Object.assign(new Error(code), { code });

describe("database busy retry", () => {
  it("retries a step that failed only because the database was busy", async () => {
    let calls = 0;
    const result = await withDbRetry(async () => { calls++; if (calls < 3) throw busy(calls === 1 ? "P1008" : "P2028"); return "done"; });
    expect(result).toBe("done");
    expect(calls).toBe(3);
  });
  it("gives up after the last try and throws any other error at once", async () => {
    let calls = 0;
    await expect(withDbRetry(async () => { calls++; throw busy("P2028"); }, 2)).rejects.toThrow("P2028");
    expect(calls).toBe(2);
    calls = 0;
    await expect(withDbRetry(async () => { calls++; throw busy("P2002"); })).rejects.toThrow("P2002");
    expect(calls).toBe(1);
  });
  it("knows the busy codes", () => {
    expect(isDbBusy(busy("P1008"))).toBe(true);
    expect(isDbBusy(busy("P2034"))).toBe(true);
    expect(isDbBusy(new Error("x"))).toBe(false);
    expect(isDbBusy(null)).toBe(false);
  });
});
