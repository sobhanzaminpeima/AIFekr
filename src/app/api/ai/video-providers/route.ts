export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import * as qwen from "@/lib/ai/qwen";

// User-facing list of usable text-to-video models, for the model picker on
// the video generation tool. Image-to-video always goes through Replicate
// (see qwen.ts's re-export comment) regardless of this choice, so it's not
// listed here — only providers that generate video from a plain text prompt.
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const providers = [
    { id: "qwen", name: "Qwen (HappyHorse T2V)", configured: qwen.isQwenVideoAvailable },
    { id: "replicate", name: "Replicate (Wan 2.1)", configured: !!(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== "r8_your-token-here") },
  ].filter((p) => p.configured);

  return NextResponse.json({ providers });
}
