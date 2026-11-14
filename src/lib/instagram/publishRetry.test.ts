import { describe, expect, it } from "vitest";
import { afterPublishFailure, RETRY_DELAY_MS } from "./publishRetry";

const now = new Date("2026-11-12T10:00:00Z");

describe("publish retry", () => {
  it("tries a failed Instagram publish once more, ten minutes later, without alarming the owner", () => {
    const r = afterPublishFailure(0, true, now);
    expect(r).toMatchObject({ status: "PENDING", attempts: 1, notify: false });
    expect(r.scheduledFor!.getTime() - now.getTime()).toBe(RETRY_DELAY_MS);
  });
  it("marks it failed and tells the owner after the retry also fails", () => {
    expect(afterPublishFailure(1, true, now)).toMatchObject({ status: "FAILED", attempts: 2, notify: true, scheduledFor: null });
  });
  it("never retries what waiting cannot fix", () => {
    expect(afterPublishFailure(0, false, now)).toMatchObject({ status: "FAILED", notify: true });
  });
});
