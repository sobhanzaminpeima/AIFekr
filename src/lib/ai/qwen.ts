// Qwen (Alibaba DashScope) image + video generation — preferred provider when
// DASHSCOPE_API_KEY is configured; src/lib/ai/fal.ts and replicate.ts remain
// as the fallback path (same "hasX" + dev-placeholder pattern used there) so
// this is a swap, not a rewrite of the calling routes.

const hasQwen = !!(process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_API_KEY !== "your-dashscope-api-key-here");

const API_BASE = "https://dashscope-intl.aliyuncs.com";
const IMAGE_MODEL = process.env.QWEN_IMAGE_MODEL || "qwen-image-3.0-pro";
const VIDEO_MODEL = process.env.QWEN_VIDEO_MODEL || "happyhorse-1.1-t2v";

function authHeaders(extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    ...extra,
  };
}

// ─── Image ──────────────────────────────────────────────────────────────────

export type ImageStyle = "realistic" | "anime" | "painting" | "sketch" | "3d" | "cinematic";

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: "photorealistic, high quality, 8k, detailed",
  anime: "anime style, manga, japanese animation, vibrant colors",
  painting: "oil painting, artistic, classical art style, brushstrokes",
  sketch: "pencil sketch, hand drawn, black and white, detailed linework",
  "3d": "3d render, CGI, octane render, volumetric lighting",
  cinematic: "cinematic, movie still, dramatic lighting, widescreen",
};

export interface GenerateImageOptions {
  prompt: string;
  style: ImageStyle;
  ratio: "1:1" | "16:9" | "9:16" | "4:3";
  count: number;
}

export const isQwenImageAvailable = hasQwen;

interface QwenMultimodalContent {
  text?: string;
  image?: string;
}

interface QwenGenerationResponse {
  output?: {
    choices?: Array<{
      message?: { content?: QwenMultimodalContent[] };
    }>;
  };
  code?: string;
  message?: string;
}

async function callQwenImage(promptText: string, referenceImageUrl: string | undefined, count: number): Promise<string[]> {
  const content: QwenMultimodalContent[] = [];
  if (referenceImageUrl) content.push({ image: referenceImageUrl });
  content.push({ text: promptText });

  // The multimodal-generation endpoint returns one image per call — count is
  // handled by issuing `count` parallel requests rather than a batch param,
  // since the documented API doesn't expose a num_images option.
  const requests = Array.from({ length: count }, async () => {
    const res = await fetch(`${API_BASE}/api/v1/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: IMAGE_MODEL,
        input: { messages: [{ role: "user", content }] },
        parameters: { prompt_extend: true },
      }),
    });
    if (!res.ok) throw new Error(`Qwen image generation failed: HTTP ${res.status}`);
    const data = (await res.json()) as QwenGenerationResponse;
    if (data.code) throw new Error(`Qwen image generation error: ${data.message || data.code}`);
    const images = data.output?.choices?.[0]?.message?.content?.map((c) => c.image).filter((u): u is string => !!u) || [];
    if (images.length === 0) throw new Error("Qwen image generation returned no image");
    return images[0];
  });

  return Promise.all(requests);
}

export async function generateImages(opts: GenerateImageOptions): Promise<string[]> {
  if (!hasQwen) {
    return Array.from({ length: opts.count }, (_, i) => `https://picsum.photos/seed/${Date.now() + i}/1024/1024`);
  }
  const promptText = `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}, aspect ratio ${opts.ratio}`;
  return callQwenImage(promptText, undefined, opts.count);
}

export async function generateImagesHQ(opts: GenerateImageOptions): Promise<string[]> {
  // Qwen-Image-3.0-Pro is already the high-quality tier — no separate fast/HQ split like FLUX schnell/dev.
  return generateImages(opts);
}

/** Image-to-image: generates a new image guided by a user-uploaded reference photo instead of from text alone. */
export async function generateImageFromReference(opts: GenerateImageOptions & { imageUrl: string }): Promise<string[]> {
  if (!hasQwen) {
    return Array.from({ length: opts.count }, (_, i) => `https://picsum.photos/seed/${Date.now() + i + 200}/1024/1024`);
  }
  const promptText = `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`;
  return callQwenImage(promptText, opts.imageUrl, opts.count);
}

// ─── Video ──────────────────────────────────────────────────────────────────

export interface VideoOptions {
  prompt: string;
  duration: 5 | 10 | 30;
  ratio: "16:9" | "9:16" | "1:1";
  style: string;
}

export const isQwenVideoAvailable = hasQwen;

// DashScope only documents 5/10s durations for HappyHorse T2V — 30s requests
// are clamped down rather than sent to an API that would reject them.
function clampDuration(duration: number): 5 | 10 {
  return duration >= 10 ? 10 : 5;
}

interface QwenTaskCreateResponse {
  output?: { task_id?: string; task_status?: string };
  code?: string;
  message?: string;
}

export async function generateVideo(opts: VideoOptions): Promise<{ predictionId: string; status: string }> {
  if (!hasQwen) {
    return { predictionId: `dev_${Date.now()}`, status: "starting" };
  }

  const res = await fetch(`${API_BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: "POST",
    headers: authHeaders({ "X-DashScope-Async": "enable" }),
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input: { prompt: opts.prompt },
      parameters: { resolution: "720P", ratio: opts.ratio, duration: clampDuration(opts.duration) },
    }),
  });
  if (!res.ok) throw new Error(`Qwen video generation failed: HTTP ${res.status}`);
  const data = (await res.json()) as QwenTaskCreateResponse;
  if (data.code || !data.output?.task_id) throw new Error(`Qwen video generation error: ${data.message || data.code || "no task_id"}`);

  // Prefixed so the status route can tell a Qwen task id apart from a
  // Replicate prediction id (they're both opaque strings otherwise).
  return { predictionId: `qwen:${data.output.task_id}`, status: data.output.task_status || "PENDING" };
}

/**
 * Image-to-video is NOT wired to Qwen yet — the user only supplied a
 * text-to-video (HappyHorse T2V) example, and DashScope's image-to-video
 * model name/schema wasn't confirmed. This still routes through Replicate
 * (see src/lib/ai/replicate.ts) until a confirmed Qwen I2V endpoint is given.
 */
export { generateVideoFromReference } from "@/lib/ai/replicate";

interface QwenTaskStatusResponse {
  output?: {
    task_status?: string;
    video_url?: string;
    results?: { video_url?: string };
  };
  message?: string;
}

/** Polls a Qwen task id (without the "qwen:" prefix) and normalizes to the same {status, output, error} shape replicate.ts's getPredictionStatus returns. */
export async function getQwenTaskStatus(taskId: string): Promise<{ status: string; output: string | null; error?: string }> {
  if (taskId.startsWith("dev_")) {
    return { status: "succeeded", output: "https://placehold.co/1280x720/1a1a1a/ea580c?text=Video+Preview" };
  }

  const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, { headers: authHeaders() });
  if (!res.ok) return { status: "failed", output: null, error: `HTTP ${res.status}` };
  const data = (await res.json()) as QwenTaskStatusResponse;

  const rawStatus = data.output?.task_status || "UNKNOWN";
  // Normalize DashScope's PENDING/RUNNING/SUCCEEDED/FAILED to the
  // lowercase starting/processing/succeeded/failed vocabulary the rest of
  // this codebase (Replicate-shaped) already expects.
  const statusMap: Record<string, string> = {
    PENDING: "starting",
    RUNNING: "processing",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
  };
  const status = statusMap[rawStatus] || rawStatus.toLowerCase();
  const output = data.output?.video_url || data.output?.results?.video_url || null;

  return { status, output, error: status === "failed" ? data.message : undefined };
}

// ─── Music ──────────────────────────────────────────────────────────────────
// Not requested — music generation still goes through replicate.ts (meta/musicgen).
