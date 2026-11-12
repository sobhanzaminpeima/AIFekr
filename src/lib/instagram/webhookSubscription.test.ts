import { describe, expect, it } from "vitest";
import { readWebhookSubscription } from "@/lib/instagram";

const all = ["comments", "messages", "messaging_postbacks"];

describe("Instagram webhook subscription read-back", () => {
  it("recognises the Instagram Login shape, whose id is not the configured app id (production 2026-11-12)", () => {
    expect(readWebhookSubscription({ data: [{ id: "17841400000000000", subscribed_fields: all }] }, "1234567890")).toEqual({ subscribed: true, fields: all });
  });
  it("still honours the older application.id shape", () => {
    expect(readWebhookSubscription({ data: [{ application: { id: "app" }, subscribed_fields: all }] }, "app").subscribed).toBe(true);
    expect(readWebhookSubscription({ data: [{ application: { id: "other" }, subscribed_fields: all }] }, "app").subscribed).toBe(false);
  });
  it("is not subscribed with missing fields or no entries", () => {
    expect(readWebhookSubscription({ data: [{ id: "x", subscribed_fields: ["comments"] }] }, "app").subscribed).toBe(false);
    expect(readWebhookSubscription({ data: [] }, "app")).toEqual({ subscribed: false, fields: [] });
  });
});
