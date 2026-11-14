import { voiceTrialStatus } from "@/lib/voice-studio/service";

/**
 * Free trials as one list (roadmap E4, first slice). Each entry is counted by
 * the same code that enforces it at generation time, so nothing can promise a
 * trial the product does not give. Voice is the only module with a trial
 * today; a new module adds its own entry here.
 */
export interface TrialStatus {
  module: "voice";
  total: number;
  remaining: number;
  maxSeconds: number | null;
  /** The account's plan already includes the tool, so no trial applies. */
  coveredByPlan: boolean;
}

export async function trialStatuses(userId: string, device?: string | null): Promise<TrialStatus[]> {
  const voice = await voiceTrialStatus(userId, device);
  return voice.enabled ? [{ module: "voice", total: voice.total, remaining: voice.remaining, maxSeconds: voice.maxSeconds, coveredByPlan: voice.coveredByPlan }] : [];
}
