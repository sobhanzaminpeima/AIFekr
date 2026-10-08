import { extractPdfImages } from "@/lib/student/pdfImages";
import { tri } from "@/lib/i18n/tri";
export const dynamic = "force-dynamic";
export const maxDuration=300;

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
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const lang=await getServerLang();
  const limit = rateLimit(`student-ocr:${user.id}`, 8, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "درخواست OCR زیاد است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "فرم فایل معتبر نیست" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "فایل الزامی است" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "حجم فایل باید حداکثر ۱۰ مگابایت باشد" }, { status: 413 });
  const isPdf=file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf");
  const isPptx = file.name.toLowerCase().endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (!isPdf && !isPptx && !IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: tri(lang,"فقط تصویر، PDF اسکن‌شده یا فایل PPTX پشتیبانی می‌شود","Upload an image, scanned PDF or PPTX","Bild, gescanntes PDF oder PPTX hochladen","Görsel, taranmış PDF veya PPTX yükleyin") }, { status: 415 });
  const charge = await reserveToolCredits(user.id, "student.ocr", { cost: 2 });
  if (!charge.ok) return charge.response;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const images = isPdf ? await extractPdfImages(buffer) : isPptx
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
    if(error instanceof Error && ["PDF_PAGE_LIMIT","PDF_IMAGE_LIMIT"].includes(error.message)) return NextResponse.json({error:tri(lang,"PDF اسکن‌شده را به بخش‌های حداکثر ۱۲ صفحه تقسیم کنید؛ اعتبار بازگردانده شد.","Split scanned PDFs into up to 12 pages per upload; credits refunded.","Gescanntes PDF in höchstens 12 Seiten pro Upload aufteilen; Credits erstattet.","Taranmış PDF’yi yükleme başına en fazla 12 sayfaya bölün; krediler iade edildi.")},{status:413});
    console.error("student OCR failed", error);
    return NextResponse.json({ error: tri(lang,"استخراج متن تصویر انجام نشد؛ اعتبار بازگردانده شد","Text extraction failed; credits refunded","Texterkennung fehlgeschlagen; Credits erstattet","Metin çıkarılamadı; krediler iade edildi") }, { status: 502 });
  }
}
