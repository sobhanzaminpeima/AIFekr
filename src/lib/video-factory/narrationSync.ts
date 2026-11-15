import type { Manifest } from "./domain";
import type { ProductionPlan } from "./production";
import { ownedAsset, storagePath } from "./assets";
import { mediaCommand } from "./render";

/** Seconds of breathing room after each narration clip. */
export const NARRATION_PAD = 0.3;
/** Screen time for a shot without narration and without a time set by the creator. */
export const SILENT_SHOT_SECONDS = 3;

/**
 * Times every shot to its own narration instead of splitting the film equally.
 * Only shots whose time was never set (by the creator or the editor) are changed:
 * a voiced shot gets its clip length plus a short pause, a silent one a short still.
 * The film's total length stays the configured duration; timeline() scales these
 * weights to it, so the pacing follows the voice.
 */
export function timedManifest(manifest: Manifest, voiceSeconds: Record<string, number>): Manifest {
  return {
    ...manifest,
    chapters: manifest.chapters.map((chapter) => ({
      ...chapter,
      shots: chapter.shots.map((shot) => {
        if (shot.durationSeconds) return shot;
        const voice = voiceSeconds[shot.id];
        const seconds = voice ? Math.round((voice + NARRATION_PAD) * 10) / 10 : SILENT_SHOT_SECONDS;
        return { ...shot, durationSeconds: Math.min(600, Math.max(0.5, seconds)) };
      }),
    })),
  };
}

/** Measures each shot's generated narration (ffprobe) and returns the timed manifest; unreadable clips are skipped. */
export async function syncToNarration(manifest: Manifest, plan: ProductionPlan, userId: string, signal: AbortSignal): Promise<Manifest> {
  const voiceSeconds: Record<string, number> = {};
  for (const shot of manifest.chapters.flatMap((c) => c.shots)) {
    const assetId = plan.assetIds[`tts-${shot.id}`];
    if (!assetId || shot.durationSeconds) continue;
    try {
      const asset = await ownedAsset(userId, assetId);
      const info = JSON.parse(await mediaCommand("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", storagePath(asset.storageKey)], signal));
      const seconds = Number(info.format?.duration);
      if (Number.isFinite(seconds) && seconds > 0) voiceSeconds[shot.id] = seconds;
    } catch { /* A missing clip keeps the shot's default timing. */ }
  }
  return timedManifest(manifest, voiceSeconds);
}
