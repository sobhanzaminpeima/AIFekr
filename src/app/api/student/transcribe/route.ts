export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { rateLimit } from "@/lib/utils/rateLimit";
import { reserveToolCredits } from "@/lib/utils/toolCredits";
import { PROVIDERS } from "@/lib/ai/providers";
import { getServerLang } from "@/lib/i18n/server";

const MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/mp4a-latm", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/flac"]);

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-transcribe:${user.id}`, 5, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "درخواست رونویسی زیاد است؛ کمی بعد تلاش کنید" }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "فرم صوت معتبر نیست" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "فایل صوتی الزامی است" }, { status: 400 });
  const allowedByExtension = /\.(mp3|mp4|m4a|wav|webm|ogg|flac)$/i.test(file.name);
  if (!AUDIO_TYPES.has(file.type) && !allowedByExtension) return NextResponse.json({ error: "فقط MP3، M4A، WAV، WebM، OGG یا FLAC پشتیبانی می‌شود" }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "حجم فایل صوتی باید حداکثر ۲۵ مگابایت باشد" }, { status: 413 });
  const provider = PROVIDERS.find((item) => item.id === "openai-direct");
  if (!provider?.apiKey || provider.apiKey.length < 10) return NextResponse.json({ error: "سرویس رونویسی صوت تنظیم نشده است" }, { status: 503 });

  const charge = await reserveToolCredits(user.id, "student.transcribe", { cost: 2 });
  if (!charge.ok) return charge.response;
  try {
    const body = new FormData();
    body.set("file", file, file.name);
    body.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    body.set("response_format", "json");
    const language = await getServerLang();
    if (language !== "fa") body.set("language", language);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let response: Response;
    try {
      response = await fetch(`${provider.baseURL}/audio/transcriptions`, {
        method: "POST", body, signal: controller.signal,
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error(`TRANSCRIPTION_PROVIDER_${response.status}`);
    const result = await response.json();
    if (typeof result?.text !== "string" || !result.text.trim()) throw new Error("TRANSCRIPTION_EMPTY");
    return NextResponse.json({ text: result.text.trim().slice(0, 100_000), creditsUsed: charge.credits });
  } catch (error) {
    await charge.release();
    console.error("student transcription failed", error);
    const message = error instanceof Error && error.message === "TRANSCRIPTION_PROVIDER_413"
      ? "فایل صوتی از حد مجاز سرویس بیشتر است"
      : "رونویسی انجام نشد؛ اعتبار کسر نشد. تنظیمات سرویس صوت را بررسی کنید";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
