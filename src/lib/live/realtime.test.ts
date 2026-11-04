import { describe, expect, it } from "vitest";
import { orderChunks, realtimeInstructions } from "./realtime";
import { LIVE_PROMPT } from "./service";

const chunk = (n: number) => new Uint8Array([n, n]);
const fresh = () => ({ nextSeq: 0, early: new Map<number, Uint8Array>(), gapSince: 0 });
const ids = (list: Uint8Array[]) => list.map((c) => c[0]);

describe("AIFekr Live microphone stream", () => {
  it("forwards chunks in order when uploads arrive out of order", () => {
    const s = fresh();
    expect(ids(orderChunks(s, 1, chunk(1), 0))).toEqual([]);
    expect(ids(orderChunks(s, 2, chunk(2), 10))).toEqual([]);
    expect(ids(orderChunks(s, 0, chunk(0), 20))).toEqual([0, 1, 2]);
    expect(ids(orderChunks(s, 3, chunk(3), 30))).toEqual([3]);
    expect(ids(orderChunks(s, 1, chunk(1), 40))).toEqual([]); // late duplicate
  });

  it("waits for a missing chunk (a retried upload) instead of dropping it at once", () => {
    const s = fresh();
    orderChunks(s, 0, chunk(0), 0);
    for (let n = 2; n < 10; n++) expect(ids(orderChunks(s, n, chunk(n), n * 100))).toEqual([]);
    expect(ids(orderChunks(s, 1, chunk(1), 1000))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("skips a chunk that never comes after 1.5 s, keeping the stream going", () => {
    const s = fresh();
    orderChunks(s, 0, chunk(0), 0);
    orderChunks(s, 2, chunk(2), 100);
    expect(ids(orderChunks(s, 3, chunk(3), 1500))).toEqual([]);
    expect(ids(orderChunks(s, 4, chunk(4), 1700))).toEqual([2, 3, 4]);
    expect(s.gapSince).toBe(0);
  });
});

describe("AIFekr Live names", () => {
  it("keeps the name the user gives and asks again rather than guessing", () => {
    expect(LIVE_PROMPT).toMatch(/use exactly that name/);
    expect(LIVE_PROMPT).toMatch(/ask them once to say it again instead of guessing/);
  });
  it("tells live mode the account name and what was said before", () => {
    const text = realtimeInstructions("fa", [{ role: "user", content: "اسمم سبحانه" }], "\n\nThe name on this user's AIFekr account is «Sobhan».");
    expect(text).toContain("«Sobhan»");
    expect(text).toContain("User: اسمم سبحانه");
  });
});
