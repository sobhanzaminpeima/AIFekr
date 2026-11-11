import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tx: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: m.tx } }));
import { chargeAndLog } from "./teamCredits";
import { BUSY_TX } from "@/lib/db/retry";

const expired = Object.assign(new Error("Transaction API error: Transaction already closed"), { code: "P2028" });
beforeEach(() => vi.clearAllMocks());

describe("chat charge under a busy database", () => {
  it("waits with the app's longer transaction limits", async () => {
    m.tx.mockResolvedValue(true);
    expect(await chargeAndLog("u1", 1, { type: "chat" })).toBe(true);
    expect(m.tx.mock.calls[0][1]).toEqual(BUSY_TX);
  });
  it("retries a charge whose transaction expired instead of leaving the answer uncharged (production 2026-11-08)", async () => {
    m.tx.mockRejectedValueOnce(expired).mockResolvedValueOnce(true);
    expect(await chargeAndLog("u1", 1, { type: "chat" })).toBe(true);
    expect(m.tx).toHaveBeenCalledTimes(2);
  });
  it("does not retry other failures", async () => {
    m.tx.mockRejectedValue(new Error("constraint failed"));
    await expect(chargeAndLog("u1", 1, { type: "chat" })).rejects.toThrow("constraint failed");
    expect(m.tx).toHaveBeenCalledTimes(1);
  });
});
