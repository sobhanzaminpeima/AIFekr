import { fal } from "@fal-ai/client";

const hasFal = !!(process.env.FAL_KEY && process.env.FAL_KEY !== "your-fal-api-key-here");

if (hasFal) {
  fal.config({ credentials: process.env.FAL_KEY });
}

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

export async function generateImages(opts: GenerateImageOptions): Promise<string[]> {
  if (!hasFal) {
    return Array.from({ length: opts.count }, (_, i) =>
      `https://picsum.photos/seed/${Date.now() + i}/1024/1024`
    );
  }

  const ratioMap: Record<string, string> = {
    "1:1": "square", "16:9": "landscape_16_9", "9:16": "portrait_9_16", "4:3": "landscape_4_3",
  };

  const result = await fal.run("fal-ai/flux/schnell", {
    input: {
      prompt: `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`,
      image_size: (ratioMap[opts.ratio] || "square") as any,
      num_images: opts.count,
      num_inference_steps: 4,
    },
  }) as unknown as { images: Array<{ url: string }> };

  return result.images.map(img => img.url);
}

export async function generateImagesHQ(opts: GenerateImageOptions): Promise<string[]> {
  if (!hasFal) {
    return Array.from({ length: opts.count }, (_, i) =>
      `https://picsum.photos/seed/${Date.now() + i + 100}/1024/1024`
    );
  }

  const result = await fal.run("fal-ai/flux/dev", {
    input: {
      prompt: `${opts.prompt}, ${STYLE_PROMPTS[opts.style] || ""}`,
      num_images: opts.count,
      guidance_scale: 3.5,
      num_inference_steps: 28,
    },
  }) as unknown as { images: Array<{ url: string }> };

  return result.images.map(img => img.url);
}
