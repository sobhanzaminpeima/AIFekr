import { describe, expect, it } from "vitest";
import { commentFunnel } from "./commentFunnel";

const link = (utm: string, clicks: number) => ({ url: `https://aifekr.com/voice-studio?utm_source=instagram&utm_campaign=${utm}`, clicks });

describe("comment funnel for a campaign", () => {
  const campaigns = [
    { id: "c1", links: JSON.stringify([link("instagram_aifekr_voice_launch", 7), link("other", 99)]), triggerCount: 20 },
    { id: "c2", links: JSON.stringify([link("instagram_aifekr_voice_launch_old", 5)]), triggerCount: 3 },
    { id: "c3", links: "{broken", triggerCount: 4 },
  ];
  const logs = [
    { campaignId: "c1", status: "sent", count: 15 },
    { campaignId: "c1", status: "failed", count: 2 },
    { campaignId: "c2", status: "sent", count: 3 },
  ];

  it("counts comments, DMs and clicks of the comment campaigns carrying exactly this UTM", () => {
    expect(commentFunnel("instagram_aifekr_voice_launch", campaigns, logs)).toEqual({ campaigns: 1, comments: 20, dmsSent: 15, dmsFailed: 2, linkClicks: 7 });
  });
  it("has no top of funnel when no comment campaign carries the UTM", () => {
    expect(commentFunnel("instagram_aifekr_live_launch", campaigns, logs)).toBeNull();
  });
});
