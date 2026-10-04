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
    const mod = (await import("pdf-parse")) as unknown as ((b: Buffer) => Promise<{ text: string }>) | { default: (b: Buffer) => Promise<{ text: string }> };
    return (typeof mod === "function" ? mod : mod.default)(buf).then((result) => result.text || "");
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
  const materials = await prisma.studentMaterial.findMany({ where: { courseId, userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ materials });
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
  try {
    if (req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData();
      courseId = form.get("courseId"); file = form.get("file"); titleField = form.get("title"); textField = form.get("content"); ocrTextField = form.get("ocrText"); sourceField = form.get("source");
    } else {
      const body: unknown = await req.json();
      if (!body || typeof body !== "object") throw new Error("invalid body");
      const value = body as Record<string, unknown>;
      courseId = value.courseId; titleField = value.title; textField = value.content; ocrTextField = value.ocrText; sourceField = value.source;
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
  if (!title || !content) return NextResponse.json({ error: "عنوان و محتوای قابل‌خواندن الزامی است" }, { status: 400 });
  if (looksLikeInjectionAttempt(content) || looksLikeInjectionAttempt(title)) return NextResponse.json({ error: "محتوا شامل الگوی دستور ناامن است و پذیرفته نشد" }, { status: 400 });
  const material = await prisma.studentMaterial.create({ data: { userId: user.id, courseId, title, content, source } });
  return NextResponse.json({ material: { ...material, content: undefined } }, { status: 201 });
}
