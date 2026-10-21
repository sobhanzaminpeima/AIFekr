import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstagramWebhookSubscription, subscribeToInstagramWebhooks } from "@/lib/instagram";

const previousAppId = process.env.INSTAGRAM_APP_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousAppId === undefined) delete process.env.INSTAGRAM_APP_ID;
  else process.env.INSTAGRAM_APP_ID = previousAppId;
});

describe("Instagram webhook subscription", () => {
  it("sends the required fields securely and rejects HTTP 200 without success", async () => {
    process.env.INSTAGRAM_APP_ID = "test-instagram-app";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(subscribeToInstagramWebhooks("ig-user", "private-token"))
      .rejects.toThrow("Meta درخواست اشتراک وبهوک را تأیید نکرد؛");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/ig-user/subscribed_apps");
    expect(url).not.toContain("private-token");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("subscribed_fields=comments%2Cmessages%2Cmessaging_postbacks");
    expect(String(init.body)).toContain("access_token=private-token");
  });

  it("verifies all required fields against the configured Instagram app", async () => {
    process.env.INSTAGRAM_APP_ID = "expected-app";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
      { application: { id: "another-app" }, subscribed_fields: ["comments", "messages", "messaging_postbacks"] },
      { application: { id: "expected-app" }, subscribed_fields: ["comments", "messages", "messaging_postbacks"] },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getInstagramWebhookSubscription("ig-user", "private-token"))
      .resolves.toEqual({ subscribed: true, fields: ["comments", "messages", "messaging_postbacks"] });
  });

  it("reports an incomplete account subscription", async () => {
    process.env.INSTAGRAM_APP_ID = "expected-app";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
      { application: { id: "expected-app" }, subscribed_fields: ["messages"] },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getInstagramWebhookSubscription("ig-user", "private-token"))
      .resolves.toEqual({ subscribed: false, fields: ["messages"] });
  });
});
