import { NextRequest, NextResponse } from "next/server";
import { getServerLang } from "@/lib/i18n/server";
import { shellData, shellGate } from "@/lib/layout/platformShellData";
import { shellCopy } from "@/lib/layout/shellCopy";
import { sidebarAccess } from "@/lib/layout/sidebarAccess";
import { sidebarModel } from "@/lib/layout/sidebarModel";

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
  return NextResponse.json({
    redirect: null,
    lang,
    user: {
      name: user.name, plan: user.plan, planName: copy.planNames[user.plan] ?? user.plan, role: user.role, accountType: user.accountType,
      credits: data.displayCredits, pendingPaymentCount: data.pendingPaymentCount, studentWorkspaceEnabled: data.studentWorkspaceEnabled, showFitness: data.showFitness,
    },
    access: sidebarAccess(user),
    banners: { expired: data.expired, expiresAt: data.expiresAt ?? null, trial: data.showTrialBanner && user.trialEndsAt ? { endsAt: user.trialEndsAt.toISOString(), limited: user.trialLimited } : null },
    conversations: data.conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
    copy,
    model: sidebarModel(lang, copy.nav, path.split("?")[0]),
  }, noStore);
}
