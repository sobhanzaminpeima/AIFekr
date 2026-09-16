export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavShell from "@/components/layout/MobileNavShell";
import FloatingSupportWidget from "@/components/support/FloatingSupportWidget";
import SessionWatchdog from "@/components/layout/SessionWatchdog";
import TrialBanner from "@/components/layout/TrialBanner";
import { getServerLang } from "@/lib/i18n/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) redirect("/login");
  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  // Same bug as the root layout (see its comment): this used to fall back to
  // a hardcoded "fa" for a missing cookie, so an admin's "default_language"
  // site setting never reached the dashboard shell itself -- the root
  // layout's <html lang> could say "en" while every visible word in the
  // sidebar stayed Persian. getServerLang() is the one place that correctly
  // checks the DB setting.
  const lang = await getServerLang();

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, credits: true, plan: true, isBlocked: true, industryPackId: true, onboardingDone: true, trialEndsAt: true, trialLimited: true },
  });

  if (!user || user.isBlocked) redirect("/login");

  // Redirect new users to onboarding wizard (welcome is outside this layout group)
  if (!user.onboardingDone) redirect("/welcome");

  // If this user has joined a team (as owner or member), the sidebar should
  // show the shared team credit pool instead of user.credits — actual
  // deduction already goes through the pool, see src/lib/utils/teamCredits.ts.
  const teamMembership = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    include: { team: { select: { credits: true } } },
  });
  const displayCredits = teamMembership?.team.credits ?? user.credits;

  // tool: "support" tags the floating support assistant's own conversations
  // (see src/lib/orchestrator/support -- same reuse-Conversation/Message
  // pattern the image/CEO/meeting chats already use, distinguished the same
  // way via Conversation.tool). Excluded here so a user's "where do I find
  // invoices" threads never show up mixed into their real chat history.
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, tool: { not: "support" } },
    select: { id: true, title: true, updatedAt: true, projectId: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      {/* Tells the user their session lapsed instead of letting an action fail
          silently — see the component's comment. */}
      <SessionWatchdog lang={lang} />
      <MobileNavShell
        lang={lang}
        sidebar={
          <Sidebar
            user={{ ...user, credits: displayCredits }}
            conversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))}
          />
        }
      >
        {user.trialEndsAt && <TrialBanner lang={lang} trialEndsAt={user.trialEndsAt.toISOString()} trialLimited={user.trialLimited} />}
        {children}
      </MobileNavShell>
      {/* Dashboard-only by design (Phase 1 decision) -- admin pages are on the
          orchestrator's DENY list anyway, and the public/marketing site has no
          session and a different threat model. */}
      <FloatingSupportWidget lang={lang} />
    </div>
  );
}