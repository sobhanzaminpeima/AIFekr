import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ voice: vi.fn() }));
vi.mock("@/lib/voice-studio/service", () => ({ voiceTrialStatus: m.voice }));
import { trialStatuses } from "./registry";

beforeEach(() => vi.clearAllMocks());

describe("free trial list", () => {
  it("reports the voice samples left, as generation counts them", async () => {
    m.voice.mockResolvedValue({ enabled: true, total: 2, remaining: 1, maxSeconds: 30, coveredByPlan: false });
    expect(await trialStatuses("u1", "dev1")).toEqual([{ module: "voice", total: 2, remaining: 1, maxSeconds: 30, coveredByPlan: false }]);
    expect(m.voice).toHaveBeenCalledWith("u1", "dev1");
  });
  it("promises nothing when the trial is switched off", async () => {
    m.voice.mockResolvedValue({ enabled: false, total: 0, remaining: 0, maxSeconds: 30, coveredByPlan: false });
    expect(await trialStatuses("u1")).toEqual([]);
  });
});
