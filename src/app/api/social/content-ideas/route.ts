export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getContentIdeas, localizeContentIdeas, type LocalizedContentIdea } from "@/lib/industry";
import { routedStreamChat } from "@/lib/ai/router";
import { getServerLang, type Lang } from "@/lib/i18n/server";

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
 *
 * All three sources respect the request's UI language (fa/en/de) — the
 * static packs are pre-translated, the LLM path is prompted and parsed
 * per-language.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const pipeline = await prisma.crmPipeline.findFirst({
    where: { userId: user.id, industrySlug: { not: null } },
    select: { industrySlug: true },
  });

  const packResult = getContentIdeas(pipeline?.industrySlug);
  if (!packResult.isGeneric) return NextResponse.json({ ideas: localizeContentIdeas(packResult.ideas, lang), isGeneric: false });

  const company = await prisma.company.findUnique({ where: { userId: user.id }, select: { name: true, industry: true, notes: true } });
  if (!company?.industry) return NextResponse.json({ ideas: localizeContentIdeas(packResult.ideas, lang), isGeneric: true });

  try {
    const businessIdeas = await generateBusinessContentIdeas(company.name, company.industry, company.notes, lang);
    if (businessIdeas.length) return NextResponse.json({ ideas: businessIdeas, isGeneric: false });
  } catch (err) {
    console.error("business-tailored content ideas failed, falling back to generic:", err);
  }

  return NextResponse.json({ ideas: localizeContentIdeas(packResult.ideas, lang), isGeneric: true });
}

const SYSTEM_PROMPT: Record<Lang, string> = {
  fa: "تو یک استراتژیست محتوای شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک JSON آرایه خام و معتبر برگردان، بدون توضیح یا markdown اضافه.",
  en: "You are a professional social media content strategist. Return ONLY a raw, valid JSON array, with no explanation or markdown.",
  de: "Du bist ein professioneller Social-Media-Content-Stratege. Gib AUSSCHLIESSLICH ein rohes, gültiges JSON-Array zurück, ohne Erklärung oder Markdown.",
};

function buildUserMessage(name: string, industry: string, extra: string, lang: Lang): string {
  if (lang === "fa") {
    return `برای کسب‌وکار «${name}» در صنعت «${industry}»${extra}، ۴ ایده فرمت محتوای پرتعامل و اثبات‌شده (نه لزوماً ترند همین لحظه) پیشنهاد بده — متناسب با همین کسب‌وکار خاص، نه یک لیست عمومی.
خروجی دقیقاً این فرمت JSON:
[{"title": "عنوان کوتاه ایده", "format": "توضیح فرمت پست (ویدیو/عکس/استوری و...)", "why": "چرا این فرمت برای این کسب‌وکار خاص موثره"}, ...4 آیتم]`;
  }
  if (lang === "de") {
    return `Schlage für das Unternehmen „${name}“ in der Branche „${industry}“${extra} 4 bewährte, engagement-starke Content-Format-Ideen vor (nicht unbedingt der aktuelle Trend) — zugeschnitten auf genau dieses Unternehmen, keine generische Liste.
Gib die Ausgabe exakt in diesem JSON-Format zurück:
[{"title": "Kurzer Titel der Idee", "format": "Beschreibung des Post-Formats (Video/Foto/Story usw.)", "why": "Warum dieses Format für genau dieses Unternehmen funktioniert"}, ...4 Elemente]`;
  }
  return `Suggest 4 proven, high-engagement content format ideas (not necessarily this week's trend) for the business "${name}" in the "${industry}" industry${extra} — tailored to this specific business, not a generic list.
Return the output in exactly this JSON format:
[{"title": "short idea title", "format": "description of the post format (video/photo/story etc.)", "why": "why this format works for this specific business"}, ...4 items]`;
}

async function generateBusinessContentIdeas(name: string, industry: string, notesJson: string | null, lang: Lang): Promise<LocalizedContentIdea[]> {
  let extra = "";
  try {
    const parsed = JSON.parse(notesJson || "{}");
    if (parsed.description) {
      extra = lang === "fa" ? `، توضیح کسب‌وکار: ${parsed.description}` : lang === "de" ? `, Unternehmensbeschreibung: ${parsed.description}` : `, business description: ${parsed.description}`;
    }
  } catch {}

  const message = buildUserMessage(name, industry, extra, lang);

  let raw = "";
  await routedStreamChat([{ role: "user", content: message }], SYSTEM_PROMPT[lang], (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 1024);

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
