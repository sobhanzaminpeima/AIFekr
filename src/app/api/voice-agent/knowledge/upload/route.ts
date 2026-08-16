export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// Extracted text lands in VoiceKnowledgeBase.content — the exact same field
// the pasted-text flow (src/app/api/voice-agent/knowledge/route.ts) writes
// to, and the exact field search_knowledge_base reads from in the Vapi
// webhook (src/app/api/webhooks/vapi/route.ts). No separate table/path.
async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    // pdf-parse (CJS, `export =`) — import * as gives the function itself
    // under interop, with `.default` as a fallback across bundler configs.
    const pdfParseModule = (await import("pdf-parse")) as unknown as
      | ((b: Buffer) => Promise<{ text: string }>)
      | { default: (b: Buffer) => Promise<{ text: string }> };
    const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;
    const result = await pdfParse(buf);
    return result.text || "";
  }

  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || "";
  }

  throw new Error("UNSUPPORTED_TYPE");
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // Reject oversized uploads by declared Content-Length before buffering the
  // body at all — req.formData() below fully reads the request into memory,
  // so checking file.size afterward doesn't bound worst-case memory usage.
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_FILE_BYTES * 1.5) {
    // *1.5 headroom for multipart boundary/field overhead around the file itself.
    return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }

  const file = formData.get("file");
  const titleField = formData.get("title");
  const agentIdField = formData.get("agentId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)" }, { status: 400 });
  }

  const agentId = typeof agentIdField === "string" && agentIdField ? agentIdField : undefined;
  if (agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) return NextResponse.json({ error: "ایجنت نامعتبر است" }, { status: 400 });
  }

  let text: string;
  try {
    text = await extractText(file);
  } catch (e) {
    if (e instanceof Error && e.message === "UNSUPPORTED_TYPE") {
      return NextResponse.json({ error: "نوع فایل پشتیبانی نمی‌شود — فقط PDF و DOCX مجاز است" }, { status: 400 });
    }
    return NextResponse.json({ error: "امکان خواندن محتوای این فایل وجود نداشت" }, { status: 422 });
  }

  text = text.trim();
  if (!text) {
    return NextResponse.json({ error: "متنی از این فایل استخراج نشد" }, { status: 422 });
  }

  const title = typeof titleField === "string" && titleField.trim() ? titleField.trim() : file.name;

  // This text reaches a live call assistant's context verbatim (via the
  // search_knowledge_base tool) — reject files whose extracted text looks
  // like an attempt to override the assistant's instructions.
  if (looksLikeInjectionAttempt(text) || looksLikeInjectionAttempt(title)) {
    return NextResponse.json({ error: "محتوای این فایل شامل عباراتی است که ممکن است دستورالعمل هوش مصنوعی را نادیده بگیرد و پذیرفته نشد" }, { status: 400 });
  }

  const entry = await prisma.voiceKnowledgeBase.create({
    data: { userId: user.id, agentId: agentId || undefined, title: title.slice(0, 300), content: text.slice(0, 100000) },
  });

  return NextResponse.json({ entry });
}
