import { describe, expect, it } from "vitest";
import { trialCatalog } from "./catalog";

describe("trial catalog", () => {
  it("shows the voice trial as configured and every other module as not offered", () => {
    const list = trialCatalog({ enabled: true, trialFree: true, trialGenerations: 2, trialMaxSeconds: 30 });
    expect(list[0]).toEqual({ module: "voice", offered: true, uses: 2, limit: "30s", configureAt: "/admin/voice-studio" });
    expect(list.slice(1).every((t) => !t.offered && t.uses === 0)).toBe(true);
  });
  it("reports the voice trial off when the studio or the trial is off", () => {
    expect(trialCatalog({ enabled: false, trialFree: true, trialGenerations: 2, trialMaxSeconds: 30 })[0].offered).toBe(false);
    expect(trialCatalog({ enabled: true, trialFree: false, trialGenerations: 2, trialMaxSeconds: 30 })[0].offered).toBe(false);
  });
});
