import { afterEach, describe, expect, it, vi } from "vitest";
import { sendButtonMessage, sendTypingIndicator } from "@/lib/instagram";

afterEach(() => vi.unstubAllGlobals());

describe("Instagram Messaging API helpers", () => {
  it("sends typing sender actions to the connected account message endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendTypingIndicator("ig-account", "recipient", "token", "typing_on");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/ig-account/messages");
    expect(JSON.parse(String(init.body))).toEqual({
      recipient: { id: "recipient" },
      sender_action: "typing_on",
      access_token: "token",
    });
  });

  it("sends follow confirmation as a signed webhook postback button", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendButtonMessage("ig-account", "recipient", "token", "Follow the profile", "Continue", "DIRECT_FOLLOW_CONFIRM:log-id");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.recipient).toEqual({ id: "recipient" });
    expect(body.message.attachment.payload.buttons).toEqual([
      { type: "postback", title: "Continue", payload: "DIRECT_FOLLOW_CONFIRM:log-id" },
    ]);
  });

  it("surfaces sender-action API errors to the best-effort caller", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "not supported" } }) }));
    await expect(sendTypingIndicator("ig-account", "recipient", "token", "typing_off")).rejects.toThrow("not supported");
  });
});
