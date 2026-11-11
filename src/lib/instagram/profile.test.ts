import { describe, expect, it } from "vitest";
import { parseAccountProfile } from "./profile";

describe("Instagram account profile", () => {
  it("keeps every field the basic scope returns", () => {
    expect(parseAccountProfile({ username: "aifekr", name: "AIFekr", biography: "AI", profile_picture_url: "https://scontent.cdninstagram.com/a.jpg", followers_count: 120, follows_count: 8, media_count: 12 })).toEqual({
      username: "aifekr", name: "AIFekr", biography: "AI", profilePictureUrl: "https://scontent.cdninstagram.com/a.jpg", followersCount: 120, followsCount: 8, mediaCount: 12,
    });
  });
  it("leaves missing or invalid values empty instead of inventing them", () => {
    expect(parseAccountProfile({ username: " ", followers_count: -1, media_count: "12" })).toEqual({
      username: null, name: null, biography: null, profilePictureUrl: null, followersCount: null, followsCount: null, mediaCount: null,
    });
  });
});
