


import { cookies,headers } from "next/headers";
import { redirect } from "next/navigation";
import PendingPaymentNotice from "@/components/billing/PendingPaymentNotice";
import SubscriptionGate from "@/components/layout/SubscriptionGate";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavShell from "@/components/layout/MobileNavShell";
import FloatingSupportWidget from "@/components/support/FloatingSupportWidget";
import SessionWatchdog from "@/components/layout/SessionWatchdog";
import TrialBanner from "@/components/layout/TrialBanner";
import StudentTimerDock from "@/components/student/StudentTimerDock";
import { getServerLang } from "@/lib/i18n/server";
import { shellData, shellGate } from "@/lib/layout/platformShellData";
import DashboardPullToRefresh from "@/components/layout/DashboardPullToRefresh";
import Link from "next/link";

export async function renderPlatformShell(children:React.ReactNode,fitness=false) {
  const cookieStore = await cookies();
  const requestedPath=(await headers()).get("x-aifekr-path")||"";
  // Sign-in, onboarding, FIT and chat-only routing, shared with the new design (lib/layout/platformShellData).
  const gate = await shellGate(cookieStore.get("token")?.value, requestedPath, fitness);
  if (gate.kind === "redirect") redirect(gate.to);
  if (gate.kind === "minimal" && gate.frame === "play") return <div className="min-h-screen"><nav className="border-b p-4 flex gap-5"><Link href="/">AIFekr</Link><Link href="/chat">AI Chat</Link></nav><main>{children}</main></div>;
  if (gate.kind === "minimal") return <div className="min-h-screen"><nav className="border-b p-4"><Link href="/chat">AIFekr AI Chat</Link></nav><main>{children}</main></div>;
  const user = gate.user;

  // Same bug as the root layout (see its comment): this used to fall back to
  // a hardcoded "fa" for a missing cookie, so an admin's "default_language"
  // site setting never reached the dashboard shell itself -- the root
  // layout's <html lang> could say "en" while every visible word in the
  // sidebar stayed Persian. getServerLang() is the one place that correctly
  // checks the DB setting.
  const lang = await getServerLang();
  const { expired, expiresAt, showFitness, displayCredits, pendingPaymentCount, studentWorkspaceEnabled, showTrialBanner, conversations } = await shellData(user, fitness);

  return (
    <div className="platform-shell flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      {/* Tells the user their session lapsed instead of letting an action fail
          silently — see the component's comment. */}
      <SessionWatchdog lang={lang} />
      <MobileNavShell
        lang={lang}
        sidebar={
          <Sidebar
            user={{ ...user, credits: displayCredits, studentWorkspaceEnabled, pendingPaymentCount, showFitness }}
            conversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))}
          />
        }
      >
        {showTrialBanner && user.trialEndsAt && <TrialBanner lang={lang} trialEndsAt={user.trialEndsAt.toISOString()} trialLimited={user.trialLimited} />}
        <PendingPaymentNotice count={pendingPaymentCount} lang={lang} />
        <SubscriptionGate expired={expired} expiresAt={fitness?undefined:expiresAt} lang={lang} overlay={<>{studentWorkspaceEnabled&&<StudentTimerDock lang={lang}/>}<FloatingSupportWidget lang={lang}/></>}>{children}</SubscriptionGate>
      </MobileNavShell>
      <DashboardPullToRefresh lang={lang} />
      {/* Dashboard-only by design (Phase 1 decision) -- admin pages are on the
          orchestrator's DENY list anyway, and the public/marketing site has no
          session and a different threat model. */}
    </div>
  );
}
