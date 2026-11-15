import { FactoryError, timeline, type Manifest } from "./domain";
import type { ProductionPlan } from "./production";
import { ownedAsset, storagePath } from "./assets";
import { mediaCommand } from "./render";

/** Seconds of breathing room after each narration clip. */
export const NARRATION_PAD = 0.3;
/** Screen time for a shot without narration and without a time set by the creator. */
export const SILENT_SHOT_SECONDS = 3;

/**
 * Times every shot to its own narration instead of splitting the film equally.
 * Prefer times set by the creator or editor:
 * a voiced shot gets its clip length plus a short pause, a silent one a short still.
 * The film's total length stays the configured duration; timeline() scales these
 * weights to it. Rebalance if the scaled time would cut any narration.
 */
export function timedManifest(manifest: Manifest, voiceSeconds: Record<string, number>, totalSeconds?: number): Manifest {
  const weighted = {
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
  if (totalSeconds === undefined) return weighted;
  const edit = timeline(weighted, totalSeconds);
  // Enforce the same 2× cap as the renderer after scaling to the film duration.
  const minimum = edit.shots.map(shot => Math.max(edit.fps / 2, Math.ceil((voiceSeconds[shot.id] || 0) * edit.fps / 2)));
  if (edit.shots.every((shot, i) => shot.durationFrames >= minimum[i])) return weighted;
  const available = edit.totalFrames - minimum.reduce((sum, frames) => sum + frames, 0);
  if (available < 0) throw new FactoryError("NARRATION_EXCEEDS_VIDEO_DURATION", 400);
  const surplus = edit.shots.map((shot, i) => Math.max(0, shot.durationFrames - minimum[i]));
  const totalSurplus = surplus.reduce((sum, frames) => sum + frames, 0);
  let cumulative = 0;
  let distributed = 0;
  const secondsByShot = new Map(edit.shots.map((shot, i) => {
    cumulative += surplus[i];
    const next = totalSurplus ? Math.round(cumulative * available / totalSurplus) : 0;
    const seconds = (minimum[i] + next - distributed) / edit.fps;
    distributed = next;
    return [shot.id, seconds];
  }));
  return {
    ...weighted,
    chapters: weighted.chapters.map(chapter => ({
      ...chapter,
      shots: chapter.shots.map(shot => ({ ...shot, durationSeconds: secondsByShot.get(shot.id)! })),
    })),
  };
}

/** Measures each shot's generated narration (ffprobe) and returns the timed manifest; unreadable clips are skipped. */
export async function syncToNarration(manifest: Manifest, plan: ProductionPlan, userId: string, signal: AbortSignal): Promise<Manifest> {
  const voiceSeconds: Record<string, number> = {};
  for (const shot of manifest.chapters.flatMap((c) => c.shots)) {
    const assetId = plan.assetIds[`tts-${shot.id}`];
    if (!assetId) continue;
    try {
      const asset = await ownedAsset(userId, assetId);
      const info = JSON.parse(await mediaCommand("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", storagePath(asset.storageKey)], signal));
      const seconds = Number(info.format?.duration);
      if (Number.isFinite(seconds) && seconds > 0) voiceSeconds[shot.id] = seconds;
    } catch (error) {
      if (signal.aborted) throw error;
      // The existing renderer reports any unreadable media when opening the shot.
    }
  }
  return timedManifest(manifest, voiceSeconds, plan.configuration.durationSeconds);
}
