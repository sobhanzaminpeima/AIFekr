import { NextRequest, NextResponse } from "next/server";
import { getServerLang } from "@/lib/i18n/server";
import { shellData, shellGate } from "@/lib/layout/platformShellData";
import { shellCopy } from "@/lib/layout/shellCopy";
import { sidebarAccess } from "@/lib/layout/sidebarAccess";
import { sidebarModel } from "@/lib/layout/sidebarModel";
import { standaloneMetadata } from "@/lib/seo/publicSeo";
import { chatCopy } from "@/lib/chat/chatCopy";
import { createCopy } from "@/lib/chat/createCopy";
import { characterCopy } from "@/lib/image/characterCopy";
import { voiceCopy } from "@/lib/voice-studio/voiceCopy";
import { factoryCopy } from "@/lib/video-factory/factoryCopy";
import { crmCopy } from "@/lib/crm/crmCopy";
import { mediaPlanAccess, planNoticeCopy } from "@/lib/growth/planAccess";
import { prisma } from "@/lib/db/prisma";
import en from "@/lib/i18n/en";
import fa from "@/lib/i18n/fa";
import de from "@/lib/i18n/de";
import tr from "@/lib/i18n/tr";

// The music page offers its genres in the visitor's language (chat keeps its own list).
const MUSIC_PAGE_GENRES = { en: en.musicGeneratePage.genres, fa: fa.musicGeneratePage.genres, de: (de as typeof en).musicGeneratePage.genres, tr: tr.musicGeneratePage.genres };

export const dynamic = "force-dynamic";

/**
 * The signed-in app frame for the new design: the same gate (sign-in,
 * onboarding, FIT, chat-only) and the same sidebar and banner data as the
 * classic layout, plus the classic frame's wording. Only the caller's own data.
 */
export async function GET(req: NextRequest) {
  const path = (req.nextUrl.searchParams.get("path") || "/home").slice(0, 300);
  const gate = await shellGate(req.cookies.get("token")?.value, path);
  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (gate.kind === "redirect") return NextResponse.json({ redirect: gate.to }, noStore);
  // /play and chat-only accounts keep the classic frame; the proxy never sends them here.
  if (gate.kind === "minimal") return NextResponse.json({ redirect: null, classicFrame: gate.frame }, noStore);
  const user = gate.user;
  const lang = await getServerLang();
  const data = await shellData(user);
  const copy = shellCopy(lang);
  // The chat page's wording and options, and what its starters and photo limit depend on.
  // Chat and the create pages share the media options (styles, ratios, durations...).
  const bare = path.split("?")[0];
  const chatPage = bare === "/chat" || bare.startsWith("/chat/") || ["/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate"].includes(bare);
  const pack = chatPage && user.industryPackId ? await prisma.industryPack.findUnique({ where: { id: user.industryPackId }, select: { slug: true } }) : null;
  return NextResponse.json({
    redirect: null,
    lang,
    // The dashboard layout keeps every app page out of search engines.
    metadata: standaloneMetadata(lang, { robots: { index: false, follow: false } }),
    user: {
      name: user.name, plan: user.plan, planName: copy.planNames[user.plan] ?? user.plan, role: user.role, accountType: user.accountType,
      credits: data.displayCredits, pendingPaymentCount: data.pendingPaymentCount, studentWorkspaceEnabled: data.studentWorkspaceEnabled, showFitness: data.showFitness,
    },
    access: sidebarAccess(user),
    banners: { expired: data.expired, expiresAt: data.expiresAt ?? null, trial: data.showTrialBanner && user.trialEndsAt ? { endsAt: user.trialEndsAt.toISOString(), limited: user.trialLimited } : null },
    conversations: data.conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
    copy,
    model: sidebarModel(lang),
    // Only on the voice studio: the classic studio's wording and error messages.
    voice: bare === "/voice-studio" ? voiceCopy(lang) : null,
    // Only on the video factory: the classic factory's wording.
    factory: bare === "/video-factory" ? factoryCopy(lang) : null,
    // Only on the CRM: the classic CRM's wording and dictionary.
    crm: bare === "/crm" ? crmCopy(lang) : null,
    chat: chatPage ? { ...chatCopy(lang), ...(bare === "/music/generate" ? { musicGenres: MUSIC_PAGE_GENRES[lang] } : {}), industrySlug: pack?.slug ?? null, create: createCopy(lang), characters: bare === "/image/generate" ? characterCopy(lang) : null, planAccess: { ...(await mediaPlanAccess(user)), notice: planNoticeCopy(lang) } } : null,
  }, noStore);
}
