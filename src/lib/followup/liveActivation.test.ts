import { describe, expect, it } from "vitest";
import { liveCampaignActivation } from "./liveCampaign";

describe("Live campaign activation", () => {
  it("runs only with an active record and a ready Instagram comment campaign", () => {
    expect(liveCampaignActivation("active", "ready")).toEqual({ live: true, blockers: [] });
  });
  it("is not running when the record says active but no comment campaign sends the DM (the production contradiction)", () => {
    expect(liveCampaignActivation("active", "needs_comment_campaign")).toEqual({ live: false, blockers: ["comment_campaign_missing"] });
  });
  it("names every reason at once", () => {
    expect(liveCampaignActivation("draft", "not_connected").blockers).toEqual(["record_not_active", "instagram_not_connected"]);
    expect(liveCampaignActivation(null, "ready").blockers).toEqual(["record_missing"]);
  });
});
