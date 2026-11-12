import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { inboundEvent: { create: m.create } } }));
import { eventError, handleInbound, recordInbound } from "./inbound";

beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({}); vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("inbound event log", () => {
  it("records a processed event with its latency and no content", async () => {
    await handleInbound({ source: "instagram", type: "comment", accountRef: "ig1" }, async () => {}, "ctx");
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ source: "instagram", type: "comment", accountRef: "ig1", status: "processed", error: null });
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(data)).not.toContain("text");
  });
  it("records a failure with a short reason and does not throw", async () => {
    await expect(handleInbound({ source: "instagram", type: "message" }, async () => { throw new Error("send failed: access_token=SECRET123"); }, "ctx")).resolves.toBeUndefined();
    const data = m.create.mock.calls[0][0].data;
    expect(data.status).toBe("failed");
    expect(data.error).toContain("[redacted]");
    expect(data.error).not.toContain("SECRET123");
  });
  it("never lets a logging failure break the event", async () => {
    m.create.mockRejectedValue(new Error("disk full"));
    await expect(recordInbound({ source: "instagram", type: "comment", status: "ignored" })).resolves.toBeUndefined();
  });
  it("caps the stored reason", () => {
    expect(eventError(new Error("x".repeat(900)))).toHaveLength(300);
    expect(eventError(null)).toBeNull();
  });
});
