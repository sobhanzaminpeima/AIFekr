export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { auditContentPost } from "@/lib/agents/seoAudit";
import { routedStreamChat } from "@/lib/ai/router";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { postId } = await req.json().catch(() => ({}));
  if (!postId) return NextResponse.json({ error: "postId الزامی است" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id: postId } });
  if (!post || post.userId !== user.id) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });

  const before = auditContentPost(post);
  if (before.issues.length === 0) {
    return NextResponse.json({ post, ...before });
  }

  const issuesList = before.issues.map((i) => `- (${i.severity}) ${i.messageFa}`).join("\n");
  const systemPrompt = "تو یک ویراستار حرفه‌ای سئو هستی. مقاله زیر را با حفظ کامل لحن، ساختار کلی و صحت اطلاعات، فقط برای رفع دقیق مشکلات سئوی لیست‌شده بازنویسی کن. هیچ ایده یا بخش جدیدی که ربطی به موضوع اصلی ندارد اضافه نکن. خروجی را دقیقاً و فقط به‌صورت یک JSON خام با این فرمت بده، بدون توضیح یا markdown اضافه: {\"content\": \"...\", \"metaTitle\": \"...\", \"metaDescription\": \"...\"}";
  const userMessage = `عنوان مقاله: ${post.title}
عنوان سئو فعلی: ${post.metaTitle}
توضیحات متا فعلی: ${post.metaDescription}
کلمات کلیدی: ${post.keywords}

مشکلات سئوی شناسایی‌شده که باید برطرف شوند:
${issuesList}

متن کامل مقاله (فرمت markdown):
${post.content}`;

  let raw = "";
  try {
    await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt, (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 4096);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });

  let parsed: { content?: string; metaTitle?: string; metaDescription?: string };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });
  }
  if (!parsed.content) return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });

  // Unlike the 8-agent pipeline (seo/agent-pipeline/run), this endpoint writes
  // the LLM's rewritten content straight back to the existing post with no
  // review step at all. Screen the rewritten content/meta for injection
  // markers before persisting so a manipulated source article (e.g. one that
  // went through earlier web-search-fed generation) can't silently rewrite
  // itself into something malicious on every auto-fix pass.
  const suspicious = [parsed.content, parsed.metaTitle, parsed.metaDescription]
    .some((t) => t && looksLikeInjectionAttempt(t));
  if (suspicious) {
    return NextResponse.json({ error: "خروجی AI برای بازبینی نگه داشته شد — الگویی مشابه تلاش برای دستکاری خودکار شناسایی شد. لطفاً به‌صورت دستی بررسی کنید." }, { status: 409 });
  }

  const updated = await prisma.contentPost.update({
    where: { id: postId },
    data: {
      content: parsed.content,
      metaTitle: parsed.metaTitle || post.metaTitle,
      metaDescription: parsed.metaDescription || post.metaDescription,
    },
  });

  const after = auditContentPost(updated);
  return NextResponse.json({ post: updated, ...after });
}
