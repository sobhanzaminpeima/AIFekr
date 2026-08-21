export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getContentIdeas, type ContentIdea } from "@/lib/industry";
import { routedStreamChat } from "@/lib/ai/router";

/**
 * Engaging-format content-idea suggestions (item 6, batch2). Two sources,
 * in priority order:
 * 1. A structured industry pack (currently only real-estate) — curated,
 *    zero AI cost, keyed by CrmPipeline.industrySlug.
 * 2. Otherwise, if the account has a Company profile, ideas generated for
 *    THIS specific business (name/industry/description) via the LLM rather
 *    than one fixed generic list shown to every business — still framed as
 *    "known best practices," never "trending now" (no live trend source).
 * 3. Final fallback: the static generic pack, for accounts with neither.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const pipeline = await prisma.crmPipeline.findFirst({
    where: { userId: user.id, industrySlug: { not: null } },
    select: { industrySlug: true },
  });

  const packResult = getContentIdeas(pipeline?.industrySlug);
  if (!packResult.isGeneric) return NextResponse.json(packResult);

  const company = await prisma.company.findUnique({ where: { userId: user.id }, select: { name: true, industry: true, notes: true } });
  if (!company?.industry) return NextResponse.json(packResult);

  try {
    const businessIdeas = await generateBusinessContentIdeas(company.name, company.industry, company.notes);
    if (businessIdeas.length) return NextResponse.json({ ideas: businessIdeas, isGeneric: false });
  } catch (err) {
    console.error("business-tailored content ideas failed, falling back to generic:", err);
  }

  return NextResponse.json(packResult);
}

async function generateBusinessContentIdeas(name: string, industry: string, notesJson: string | null): Promise<ContentIdea[]> {
  let extra = "";
  try {
    const parsed = JSON.parse(notesJson || "{}");
    if (parsed.description) extra = `، توضیح کسب‌وکار: ${parsed.description}`;
  } catch {}

  const system = "تو یک استراتژیست محتوای شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک JSON آرایه خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const message = `برای کسب‌وکار «${name}» در صنعت «${industry}»${extra}، ۴ ایده فرمت محتوای پرتعامل و اثبات‌شده (نه لزوماً ترند همین لحظه) پیشنهاد بده — متناسب با همین کسب‌وکار خاص، نه یک لیست عمومی.
خروجی دقیقاً این فرمت JSON:
[{"title": "عنوان کوتاه ایده", "format": "توضیح فرمت پست (ویدیو/عکس/استوری و...)", "why": "چرا این فرمت برای این کسب‌وکار خاص موثره"}, ...4 آیتم]`;

  let raw = "";
  await routedStreamChat([{ role: "user", content: message }], system, (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 1024);

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 4).map((i: Record<string, unknown>) => ({
    title: String(i.title || ""),
    format: String(i.format || ""),
    why: String(i.why || ""),
  })).filter((i) => i.title);
}
