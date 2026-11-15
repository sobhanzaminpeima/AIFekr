/**
 * Every module's free-trial setting in one admin view (roadmap E4). Voice is
 * the only module with a trial, configured in its own admin page. Every other
 * module is listed as not offered: giving free uses is a pricing decision the
 * owner makes, so nothing here switches a trial on.
 */
export interface TrialCatalogEntry {
  module: string;
  offered: boolean;
  uses: number;
  limit: string | null;
  configureAt: string | null;
}

export const TRIAL_CANDIDATES = ["image", "video", "music", "seo", "website", "business-doctor"] as const;

export function trialCatalog(voice: { enabled: boolean; trialFree: boolean; trialGenerations: number; trialMaxSeconds: number }): TrialCatalogEntry[] {
  const voiceOffered = voice.enabled && voice.trialFree && voice.trialGenerations > 0;
  return [
    { module: "voice", offered: voiceOffered, uses: voiceOffered ? voice.trialGenerations : 0, limit: voiceOffered ? `${voice.trialMaxSeconds}s` : null, configureAt: "/admin/voice-studio" },
    ...TRIAL_CANDIDATES.map((module) => ({ module, offered: false, uses: 0, limit: null, configureAt: null })),
  ];
}
