export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";

// Read-only status of every image/video/audio generation integration wired
// into the codebase. Each entry maps 1:1 to a lib/ai/*.ts file that already
// checks its own env var(s) — this route just surfaces that same check so
// the admin panel can show configured vs. not-configured without needing a
// live API call. Add a new row here whenever a new lib/ai/*.ts provider is
// added — it becomes visible in /admin/llm without any DB migration.
const MEDIA_PROVIDERS = [
  {
    id: "openai-image",
    name: "OpenAI Images (gpt-image)",
    capability: "image" as const,
    envKey: "OPENAI_API_KEY",
    usedFor: "تولید تصویر پست اینستاگرام و بخش کسب‌وکار",
  },
  {
    id: "qwen",
    name: "Qwen Image",
    capability: "image" as const,
    envKey: "QWEN_API_KEY",
    usedFor: "fallback تولید تصویر وقتی OpenAI تنظیم نشده",
  },
  {
    id: "qwen-video",
    name: "Qwen Video (HappyHorse T2V)",
    capability: "video" as const,
    envKey: "DASHSCOPE_API_KEY",
    usedFor: "تولید ویدیو از متن در ابزار ویدیو",
  },
  {
    id: "fal",
    name: "fal.ai",
    capability: "video" as const,
    envKey: "FAL_KEY",
    usedFor: "تولید ویدیو با مدل‌های fal",
  },
  {
    id: "replicate",
    name: "Replicate",
    capability: "video" as const,
    envKey: "REPLICATE_API_TOKEN",
    usedFor: "تولید تصویر/ویدیو با مدل‌های Replicate",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    capability: "audio" as const,
    envKey: "ELEVENLABS_API_KEY",
    usedFor: "تبدیل متن به صدا (voiceover)",
  },
];

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse();
  }

  const providers = MEDIA_PROVIDERS.map((p) => {
    const value = process.env[p.envKey] || "";
    const configured = value.length > 10 && !value.toLowerCase().includes("your-") && !value.includes("placeholder");
    return { ...p, configured };
  });

  return NextResponse.json({ providers });
}
