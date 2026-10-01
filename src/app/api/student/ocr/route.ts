export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/utils/rateLimit";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { extractPptxImages, ocrImages } from "@/lib/student/ocr";
import { getServerLang } from "@/lib/i18n/server";
import { reserveToolCredits } from "@/lib/utils/toolCredits";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-ocr:${user.id}`, 8, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "درخواست OCR زیاد است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "فرم فایل معتبر نیست" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "فایل الزامی است" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "حجم فایل باید حداکثر ۱۰ مگابایت باشد" }, { status: 413 });
  const isPptx = file.name.toLowerCase().endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (!isPptx && !IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG/PNG/WebP/GIF یا فایل PPTX پشتیبانی می‌شود" }, { status: 415 });
  const charge = await reserveToolCredits(user.id, "student.ocr", { cost: 2 });
  if (!charge.ok) return charge.response;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const images = isPptx
      ? await extractPptxImages(buffer)
      : [{ name: file.name, mimeType: file.type, data: buffer }];
    if (!images.length) { await charge.release(); return NextResponse.json({ error: "در این فایل اسلایدی تصویر برای OCR پیدا نشد" }, { status: 422 }); }
    const text = await ocrImages(images, await getServerLang());
    if (!text) { await charge.release(); return NextResponse.json({ error: "متنی در فایل قابل‌خواندن نبود" }, { status: 422 }); }
    return NextResponse.json({ text, imageCount: images.length, creditsUsed: charge.credits });
  } catch (error) {
    await charge.release();
    if (error instanceof Error && error.message === "PPTX_IMAGE_LIMIT") return NextResponse.json({ error: "حجم تصاویر استخراج‌شده از PPTX بیش از حد مجاز است" }, { status: 413 });
    if (error instanceof Error && error.message === "PPTX_IMAGE_COUNT") return NextResponse.json({ error: "برای امنیت حداکثر ۱۲ تصویر در هر فایل PPTX پردازش می‌شود" }, { status: 413 });
    if (error instanceof Error && error.message === "VISION_NOT_CONFIGURED") return NextResponse.json({ error: "ارائه‌دهندهٔ هوش مصنوعی تصویری تنظیم نشده است" }, { status: 503 });
    console.error("student OCR failed", error);
    return NextResponse.json({ error: "استخراج متن تصویر انجام نشد؛ اعتبار کسر نشد" }, { status: 502 });
  }
}
