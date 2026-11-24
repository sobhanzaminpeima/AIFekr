import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import { rateLimit } from "@/lib/utils/rateLimit";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { extractPptxText } from "@/lib/student/pptx";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 100_000;

async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as ((b: Uint8Array) => Promise<{ text: string }>) | { default: (b: Uint8Array) => Promise<{ text: string }> };
    return (typeof mod === "function" ? mod : mod.default)(new Uint8Array(buf)).then((result) => result.text || "");
  }
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: buf })).value || "";
  }
  if (name.endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return extractPptxText(buf, MAX_TEXT);
  }
  throw new Error("UNSUPPORTED_TYPE");
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId الزامی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  const [materials, all] = await Promise.all([
    prisma.studentMaterial.findMany({ where: { courseId, userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.studentMaterial.findMany({ where: { userId: user.id }, select: { content: true, title: true } }),
  ]);
  // Stored size is the extracted text the platform keeps (originals are not stored).
  const usageBytes = all.reduce((sum, m) => sum + Buffer.byteLength(m.content) + Buffer.byteLength(m.title), 0);
  return NextResponse.json({ materials, usage: { bytes: usageBytes, files: all.length } });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-material:${user.id}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_FILE_BYTES * 1.5) return NextResponse.json({ error: "حجم فایل حداکثر ۱۰ مگابایت است" }, { status: 413 });
  let courseId: unknown;
  let file: unknown;
  let titleField: unknown;
  let textField: unknown;
  let ocrTextField: unknown;
  let sourceField: unknown;
  let folderField: unknown;
  try {
    if (req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData();
      courseId = form.get("courseId"); file = form.get("file"); titleField = form.get("title"); textField = form.get("content"); ocrTextField = form.get("ocrText"); sourceField = form.get("source"); folderField = form.get("folder");
    } else {
      const body: unknown = await req.json();
      if (!body || typeof body !== "object") throw new Error("invalid body");
      const value = body as Record<string, unknown>;
      courseId = value.courseId; titleField = value.title; textField = value.content; ocrTextField = value.ocrText; sourceField = value.source; folderField = value.folder;
    }
  } catch { return NextResponse.json({ error: "اطلاعات جزوه نامعتبر است" }, { status: 400 }); }
  if (typeof courseId !== "string" || !courseId) return NextResponse.json({ error: "درس الزامی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });

  let content = "";
  let title = typeof titleField === "string" ? titleField.trim() : "";
  let source = "text";
  if (file instanceof File) {
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "حجم فایل حداکثر ۱۰ مگابایت است" }, { status: 413 });
    if (!/\.(pdf|docx|pptx)$/i.test(file.name) && !["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"].includes(file.type)) {
      return NextResponse.json({ error: "فقط فایل PDF، DOCX و PPTX پشتیبانی می‌شود" }, { status: 415 });
    }
    try { content = await extractText(file); } catch (error) {
      console.error("Student material extraction failed", error instanceof Error ? { name: error.name, message: error.message } : "unknown parser failure");
      if (error instanceof Error && ["TOO_MANY_SLIDES", "PPTX_EXPANDED_LIMIT"].includes(error.message)) return NextResponse.json({ error: error.message === "TOO_MANY_SLIDES" ? "فایل حداکثر می‌تواند ۵۰۰ اسلاید داشته باشد" : "حجم بازشدهٔ محتوای اسلایدها بیش از حد مجاز است" }, { status: 413 });
      return NextResponse.json({ error: error instanceof Error && error.message === "UNSUPPORTED_TYPE" ? "فقط فایل PDF، DOCX و PPTX پشتیبانی می‌شود" : "استخراج متن فایل ناموفق بود" }, { status: 422 });
    }
    title ||= file.name;
    source = file.name.toLowerCase().endsWith(".pptx") ? "pptx" : "file";
  } else if (typeof textField === "string") {
    content = textField.trim();
    if (sourceField === "image_ocr" || sourceField === "audio_transcript") source = sourceField;
  }
  if (typeof ocrTextField === "string") content = [content, ocrTextField.trim()].filter(Boolean).join("\n\n[متن OCR تصاویر اسلاید]\n");
  content = content.trim().slice(0, MAX_TEXT);
  title = title.slice(0, 200);
  if(file instanceof File && file.name.toLowerCase().endsWith(".pdf") && !content){const lang=await getServerLang();return NextResponse.json({code:"SCANNED_PDF",error:tri(lang,"این PDF اسکن‌شده است. گزینهٔ «PDF اسکن‌شده / OCR» را فعال کنید و دوباره اضافه کنید.","This PDF has no selectable text. Enable Scanned PDF / OCR and retry.","Dieses PDF enthält keinen auswählbaren Text. Gescanntes PDF / OCR aktivieren und erneut versuchen.","Bu PDF seçilebilir metin içermiyor. Taranmış PDF / OCR seçeneğini etkinleştirin ve yeniden deneyin.")},{status:422});}
  if (!title || !content) return NextResponse.json({ error: "عنوان و محتوای قابل‌خواندن الزامی است" }, { status: 400 });
  if (looksLikeInjectionAttempt(content) || looksLikeInjectionAttempt(title)) return NextResponse.json({ error: "محتوا شامل الگوی دستور ناامن است و پذیرفته نشد" }, { status: 400 });
  const folder = cleanFolder(folderField);
  if (folder === false) return NextResponse.json({ error: "نام پوشه نامعتبر است" }, { status: 400 });
  const material = await prisma.studentMaterial.create({ data: { userId: user.id, courseId, title, content, source, folder } });
  return NextResponse.json({ material: { ...material, content: undefined } }, { status: 201 });
}

/** null = unfiled; false = invalid. */
function cleanFolder(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const folder = value.trim().replace(/\s+/g, " ");
  if (!folder) return null;
  if (folder.length > 60 || /[<>]/.test(folder)) return false;
  return folder;
}

/** Move one of the student's own sources into a folder (or out of it with folder: null). */
export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof body.id !== "string") return NextResponse.json({ error: "شناسه جزوه الزامی است" }, { status: 400 });
  const folder = cleanFolder(body.folder);
  if (folder === false) return NextResponse.json({ error: "نام پوشه نامعتبر است" }, { status: 400 });
  const moved = await prisma.studentMaterial.updateMany({ where: { id: body.id, userId: user.id }, data: { folder } });
  if (!moved.count) return NextResponse.json({ error: "جزوه پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ok: true, folder });
}
