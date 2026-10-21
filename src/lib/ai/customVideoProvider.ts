// Invocation for admin-added CustomAiProvider rows of type "video" (see
// src/app/admin/llm/page.tsx -> CustomProvidersSection, prisma schema
// CustomAiProvider.type). Video generation APIs are far more heterogeneous
// than chat/image ones — almost always async, job-based — so this
// implements one pragmatic, documented, best-effort contract mirroring the
// shape this codebase already expects from Qwen/Replicate
// ({ predictionId, status } on start, { status, output, error } on poll —
// see src/lib/ai/qwen.ts and src/app/api/video/status/route.ts). Admins
// pointing at a genuinely different job API shape will need a real
// integration instead of this generic path.
import { prisma } from "@/lib/db/prisma";

export interface StartCustomVideoOptions {
  duration?: number;
  ratio?: string;
  style?: string;
}

interface CustomVideoStartResponse {
  id?: string;
  jobId?: string;
  predictionId?: string;
  status?: string;
  error?: { message?: string } | string;
}

/**
 * POSTs to `{baseUrl}/videos/generations` with `{ model, prompt, duration,
 * ratio }` and an `Authorization: Bearer {apiKey}` header, expecting an
 * async job id back as `{ id }`, `{ jobId }`, or `{ predictionId }` plus an
 * optional `status`. Returns a predictionId prefixed
 * "custom:<providerId>:<jobId>" (mirrors qwen.ts's "qwen:" prefixing) so
 * /api/video/status can tell it apart from a Qwen or Replicate id and route
 * polling back to this same custom provider.
 */
export async function startCustomVideoJob(
  providerId: string,
  prompt: string,
  opts: StartCustomVideoOptions = {}
): Promise<{ predictionId: string; status: string }> {
  const row = await prisma.customAiProvider.findUnique({ where: { id: providerId } });
  if (!row || !row.enabled || row.type !== "video") {
    throw new Error("این مدل ویدیوی سفارشی دیگر در دسترس نیست");
  }

  const res = await fetch(`${row.baseUrl.replace(/\/$/, "")}/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${row.apiKey}`,
    },
    body: JSON.stringify({
      model: row.model,
      prompt,
      duration: opts.duration,
      ratio: opts.ratio,
      style: opts.style,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as CustomVideoStartResponse;
      const msg = typeof errBody.error === "string" ? errBody.error : errBody.error?.message;
      if (msg) detail = msg;
    } catch { /* ignore non-JSON error body */ }
    throw new Error(`شروع تولید ویدیو با مدل سفارشی ناموفق بود: ${detail}`);
  }

  const data = (await res.json()) as CustomVideoStartResponse;
  const jobId = data.id || data.jobId || data.predictionId;
  if (!jobId) throw new Error("مدل ویدیوی سفارشی شناسه‌ی کار (job id) برنگرداند");

  return { predictionId: `custom:${providerId}:${jobId}`, status: data.status || "starting" };
}

interface CustomVideoStatusResponse {
  status?: string;
  output?: string;
  url?: string;
  video_url?: string;
  error?: { message?: string } | string;
}

// Normalizes arbitrary custom-provider status strings to the
// starting/processing/succeeded/failed vocabulary the rest of this codebase
// (Replicate-shaped) already expects — same mapping approach as
// qwen.ts's getQwenTaskStatus.
const STATUS_MAP: Record<string, string> = {
  pending: "starting",
  queued: "starting",
  starting: "starting",
  running: "processing",
  processing: "processing",
  in_progress: "processing",
  succeeded: "succeeded",
  completed: "succeeded",
  success: "succeeded",
  failed: "failed",
  error: "failed",
  canceled: "canceled",
  cancelled: "canceled",
};

/**
 * Polls `{baseUrl}/videos/generations/{jobId}` (GET) with the same bearer
 * auth and normalizes the response to `{ status, output, error }` — the
 * exact shape src/app/api/video/status/route.ts already expects from
 * getQwenTaskStatus/getPredictionStatus.
 */
export async function getCustomVideoStatus(
  providerId: string,
  jobId: string
): Promise<{ status: string; output: string | null; error?: string }> {
  const row = await prisma.customAiProvider.findUnique({ where: { id: providerId } });
  if (!row) return { status: "failed", output: null, error: "این مدل ویدیوی سفارشی دیگر در دسترس نیست" };

  const res = await fetch(`${row.baseUrl.replace(/\/$/, "")}/videos/generations/${jobId}`, {
    headers: { Authorization: `Bearer ${row.apiKey}` },
  });

  if (!res.ok) return { status: "failed", output: null, error: `HTTP ${res.status}` };

  const data = (await res.json()) as CustomVideoStatusResponse;
  const rawStatus = (data.status || "unknown").toLowerCase();
  const status = STATUS_MAP[rawStatus] || rawStatus;
  const output = data.output || data.url || data.video_url || null;
  const errorMsg = typeof data.error === "string" ? data.error : data.error?.message;

  return { status, output, error: status === "failed" ? errorMsg || "خطای نامشخص" : undefined };
}
