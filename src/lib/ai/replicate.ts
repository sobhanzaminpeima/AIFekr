import Replicate from "replicate";

const hasReplicate = !!(
  process.env.REPLICATE_API_TOKEN &&
  process.env.REPLICATE_API_TOKEN !== "r8_your-token-here"
);

const replicate = hasReplicate
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;

// ─── Video ────────────────────────────────────────────────────────────────────

export interface VideoOptions {
  prompt: string;
  duration: 5 | 10 | 30;
  ratio: "16:9" | "9:16" | "1:1";
  style: string;
}

export async function generateVideo(opts: VideoOptions): Promise<{ predictionId: string; status: string }> {
  if (!replicate) {
    // Return fake prediction in dev
    return { predictionId: `dev_${Date.now()}`, status: "starting" };
  }

  // Wan-2.1 — best open-source video model
  const prediction = await replicate.predictions.create({
    model: "wavespeedai/wan-2.1-t2v-480p",
    input: {
      prompt: opts.prompt,
      num_frames: opts.duration * 16,
      guidance_scale: 5,
      num_inference_steps: 30,
    },
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`,
    webhook_events_filter: ["completed"],
  });

  return { predictionId: prediction.id, status: prediction.status };
}

export async function getPredictionStatus(predictionId: string) {
  if (!replicate || predictionId.startsWith("dev_")) {
    // Simulate completion after a bit
    return { status: "succeeded", output: "https://placehold.co/1280x720/1a1a1a/ea580c?text=Video+Preview" };
  }
  const prediction = await replicate.predictions.get(predictionId);
  return {
    status: prediction.status,
    output: Array.isArray(prediction.output) ? prediction.output[0] : prediction.output,
    error: prediction.error,
  };
}

// ─── Music ────────────────────────────────────────────────────────────────────

export interface MusicOptions {
  prompt: string;
  duration: 30 | 60 | 120;
  genre?: string;
}

export async function generateMusic(opts: MusicOptions): Promise<{ predictionId: string; status: string }> {
  if (!replicate) {
    return { predictionId: `dev_music_${Date.now()}`, status: "starting" };
  }

  const fullPrompt = opts.genre ? `${opts.genre} music, ${opts.prompt}` : opts.prompt;

  const prediction = await replicate.predictions.create({
    model: "meta/musicgen",
    input: {
      prompt: fullPrompt,
      duration: opts.duration,
      model_version: "stereo-large",
      output_format: "mp3",
      normalization_strategy: "peak",
    },
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`,
    webhook_events_filter: ["completed"],
  });

  return { predictionId: prediction.id, status: prediction.status };
}
