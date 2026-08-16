// Invocation for admin-added CustomAiProvider rows of type "image" (see
// src/app/admin/llm/page.tsx -> CustomProvidersSection, prisma schema
// CustomAiProvider.type). Custom image APIs vary wildly in shape, so this
// implements one pragmatic, documented, best-effort contract rather than
// trying to support every possible API — the same de-facto standard shape
// OpenAI's own /v1/images/generations uses and that many OpenAI-compatible
// providers (self-hosted Stable Diffusion wrappers, some Chinese providers,
// etc.) already mirror. Admins picking a genuinely different API shape will
// need a real integration instead of this generic path.
import { prisma } from "@/lib/db/prisma";

export interface GenerateCustomImageOptions {
  n?: number;
  size?: string;
}

interface CustomImageApiResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string } | string;
}

/**
 * POSTs to `{baseUrl}/images/generations` with the OpenAI-compatible body
 * `{ model, prompt, n, size }` and an `Authorization: Bearer {apiKey}`
 * header, expecting back `{ data: [{ url }] }` or `{ data: [{ b64_json }] }`.
 * Returns an array of image URLs (remote URL or `data:` URI for base64
 * responses) — callers (image/generate/route.ts) upload these to R2 exactly
 * like the built-in providers' output.
 */
export async function generateCustomImage(
  providerId: string,
  prompt: string,
  opts: GenerateCustomImageOptions = {}
): Promise<string[]> {
  const row = await prisma.customAiProvider.findUnique({ where: { id: providerId } });
  if (!row || !row.enabled || row.type !== "image") {
    throw new Error("این مدل تصویر سفارشی دیگر در دسترس نیست");
  }

  const n = opts.n ?? 1;
  const res = await fetch(`${row.baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${row.apiKey}`,
    },
    body: JSON.stringify({
      model: row.model,
      prompt,
      n,
      size: opts.size || "1024x1024",
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as CustomImageApiResponse;
      const msg = typeof errBody.error === "string" ? errBody.error : errBody.error?.message;
      if (msg) detail = msg;
    } catch { /* ignore non-JSON error body */ }
    throw new Error(`تولید تصویر با مدل سفارشی ناموفق بود: ${detail}`);
  }

  const data = (await res.json()) as CustomImageApiResponse;
  const items = data.data || [];
  if (items.length === 0) throw new Error("مدل تصویر سفارشی هیچ تصویری برنگرداند");

  return items.map((item) => {
    if (item.url) return item.url;
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    throw new Error("پاسخ مدل تصویر سفارشی فاقد url یا b64_json بود");
  });
}
