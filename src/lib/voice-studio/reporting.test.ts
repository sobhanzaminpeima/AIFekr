import { describe, expect, it } from "vitest";
import { voiceCreditsReturned } from "./reporting";

const g = (status: string, refundedCredits: number | null) => ({ status, _sum: { refundedCredits } });

describe("voice credits returned", () => {
  it("counts the unused hold of a finished job as released, not refunded (the production report)", () => {
    expect(voiceCreditsReturned([g("READY", 235)])).toEqual({ releasedHold: 235, refundedFailure: 0 });
  });
  it("counts only unfinished jobs as refunds", () => {
    expect(voiceCreditsReturned([g("READY", 50), g("FAILED", 100), g("CANCELLED", 90), g("QUEUED", null)])).toEqual({ releasedHold: 50, refundedFailure: 190 });
  });
  it("is zero without generations", () => {
    expect(voiceCreditsReturned([])).toEqual({ releasedHold: 0, refundedFailure: 0 });
  });
});
