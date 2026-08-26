import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateUniqueReferralCode } from "./referralCode";

vi.mock("@/lib/repositories/userRepository", () => ({
  findUserByReferralCode: vi.fn(),
}));

import { findUserByReferralCode } from "@/lib/repositories/userRepository";

describe("generateUniqueReferralCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a lowercase slug of the first name when free", async () => {
    vi.mocked(findUserByReferralCode).mockResolvedValue(null);
    expect(await generateUniqueReferralCode("Sobhan Karimi")).toBe("sobhan");
  });

  it("strips non-Latin characters and falls back to random on empty result", async () => {
    vi.mocked(findUserByReferralCode).mockResolvedValue(null);
    const code = await generateUniqueReferralCode("سبحان");
    expect(code).toMatch(/^[0-9a-f]{8}$/);
  });

  it("appends a numeric suffix on collision", async () => {
    vi.mocked(findUserByReferralCode)
      .mockResolvedValueOnce({ id: "existing" } as never) // "sobhan" taken
      .mockResolvedValueOnce(null); // "sobhanNNN" free
    const code = await generateUniqueReferralCode("Sobhan");
    expect(code).toMatch(/^sobhan\d{3}$/);
  });

  it("falls back to random hex with no name given", async () => {
    vi.mocked(findUserByReferralCode).mockResolvedValue(null);
    const code = await generateUniqueReferralCode();
    expect(code).toMatch(/^[0-9a-f]{8}$/);
  });
});
