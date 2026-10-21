// OpenAI (gpt-image family) image generation — preferred provider when
// OPENAI_API_KEY is configured; src/lib/ai/qwen.ts remains as the fallback
// path (same "hasX" + dev-placeholder pattern used there) so this is a
// swap, not a rewrite of the calling route.
import sharp from "sharp";

const hasOpenAIImage = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10);

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
export const openAIImageModel = IMAGE_MODEL;
export const isOpenAIImageAvailable = hasOpenAIImage;

function authHeaders(extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    ...extra,
  };
}

export type ImageStyle = "realistic" | "anime" | "painting" | "sketch" | "3d" | "cinematic";

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: "photorealistic, high quality, detailed",
  anime: "anime style, manga, japanese animation, vibrant colors",
  painting: "oil painting, artistic, classical art style, brushstrokes",
  sketch: "pencil sketch, hand drawn, black and white, detailed linework",
  "3d": "3d render, CGI, octane render, volumetric lighting",
  cinematic: "cinematic, movie still, dramatic lighting, widescreen",
};

// gpt-image only offers these three sizes (+ "auto") — ratios are mapped to
// the closest supported one rather than sent through verbatim.
function sizeForRatio(ratio: string): string {
  if (ratio === "16:9" || ratio === "4:3") return "1536x1024";
  if (ratio === "9:16") return "1024x1536";
  return "1024x1024";
}

export interface GenerateImageOptions {
  prompt: string;
  style: ImageStyle;
  ratio: "1:1" | "16:9" | "9:16" | "4:3";
  count: number;
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
}

// gpt-image responses come back as base64 (no hosted url) — callers get a
// data: URI back and are responsible for decoding it before upload, same as
// they'd fetch() a regular URL.
async function callOpenAIGenerate(promptText: string, count: number, size: string, quality: "medium" | "high"): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: promptText,
      n: count,
      size,
      quality,
    }),
  });

  const data = (await res.json()) as OpenAIImageResponse;
  if (!res.ok) throw new Error(`OpenAI image generation failed: HTTP ${res.status} ${data.error?.message || ""}`);

  const images = (data.data || [])
    .map((d) => (d.url ? d.url : d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter((u): u is string => !!u);

  if (images.length === 0) throw new Error("OpenAI image generation returned no image");
  return images;
}

async function fetchAsPng(url: string): Promise<Buffer> {
  const refRes = await fetch(url);
  if (!refRes.ok) throw new Error(`Could not fetch reference image: HTTP ${refRes.status}`);
  const rawBuf = Buffer.from(await refRes.arrayBuffer());
  // `new Blob([buf])` with no explicit type defaults to "" -> serialized as
  // application/octet-stream, which OpenAI's edit endpoint flatly rejects
  // ("unsupported mimetype") regardless of what the bytes actually are.
  // Re-encoding through sharp both fixes the declared type AND normalizes
  // whatever format the source (an upload, R2, or -- here -- our own
  // gpt-image data: URI output) happened to be in to a format OpenAI
  // accepts, rather than trusting an upstream Content-Type that may not
  // even be set.
  return sharp(rawBuf).png().toBuffer();
}

// `image[]` (repeated field) is OpenAI's documented way to pass more than
// one reference photo to gpt-image's edit endpoint in a single call -- e.g.
// two people's photos composited into one "couple" portrait. Each entry
// still goes through the same fetch+re-encode as the single-image path.
async function callOpenAIEdit(promptText: string, referenceImageUrls: string[], count: number, size: string): Promise<string[]> {
  const refBufs = await Promise.all(referenceImageUrls.map(fetchAsPng));

  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", promptText);
  form.append("n", String(count));
  form.append("size", size);
  refBufs.forEach((buf, i) => {
    form.append("image[]", new Blob([new Uint8Array(buf)], { type: "image/png" }), `reference-${i}.png`);
  });

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  const data = (await res.json()) as OpenAIImageResponse;
  if (!res.ok) throw new Error(`OpenAI image edit failed: HTTP ${res.status} ${data.error?.message || ""}`);

  const images = (data.data || [])
    .map((d) => (d.url ? d.url : d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter((u): u is string => !!u);

  if (images.length === 0) throw new Error("OpenAI image edit returned no image");
  return images;
}

export async function generateImages(opts: GenerateImageOptions): Promise<string[]> {
  if (!hasOpenAIImage) {
    return Array.from({ length: opts.count }, (_, i) => `https://picsum.photos/seed/${Date.now() + i}/1024/1024`);
  }
  const promptText = `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`;
  return callOpenAIGenerate(promptText, opts.count, sizeForRatio(opts.ratio), "medium");
}

export async function generateImagesHQ(opts: GenerateImageOptions): Promise<string[]> {
  if (!hasOpenAIImage) {
    return Array.from({ length: opts.count }, (_, i) => `https://picsum.photos/seed/${Date.now() + i + 100}/1024/1024`);
  }
  const promptText = `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`;
  return callOpenAIGenerate(promptText, opts.count, sizeForRatio(opts.ratio), "high");
}

/**
 * Image-to-image: generates a new image guided by one or more user-uploaded
 * reference photos instead of from text alone (e.g. two people for a
 * "couple" prompt). `imageUrl` is kept as an alias for the single-image
 * case so existing callers (character board, etc.) don't need to change.
 */
export async function generateImageFromReference(
  opts: GenerateImageOptions & { imageUrl?: string; imageUrls?: string[] }
): Promise<string[]> {
  const urls = opts.imageUrls?.length ? opts.imageUrls : opts.imageUrl ? [opts.imageUrl] : [];
  if (urls.length === 0) throw new Error("generateImageFromReference: no reference image provided");
  if (!hasOpenAIImage) {
    return Array.from({ length: opts.count }, (_, i) => `https://picsum.photos/seed/${Date.now() + i + 200}/1024/1024`);
  }
  const promptText = `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`;
  return callOpenAIEdit(promptText, urls, opts.count, sizeForRatio(opts.ratio));
}
