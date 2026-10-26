


import { cookies,headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import PendingPaymentNotice from "@/components/billing/PendingPaymentNotice";
import SubscriptionGate from "@/components/layout/SubscriptionGate";
import {featureAccessExpired,teamFeatureExpiry} from "@/lib/subscriptions/access";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavShell from "@/components/layout/MobileNavShell";
import FloatingSupportWidget from "@/components/support/FloatingSupportWidget";
import SessionWatchdog from "@/components/layout/SessionWatchdog";
import TrialBanner from "@/components/layout/TrialBanner";
import StudentTimerDock from "@/components/student/StudentTimerDock";
import { getServerLang } from "@/lib/i18n/server";
import { chatHistoryWhere } from "@/lib/chat/history";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";
import { shouldShowTrialBanner } from "@/lib/subscriptions/trialBanner";
import DashboardPullToRefresh from "@/components/layout/DashboardPullToRefresh";
import {standaloneChatOnly} from "@/lib/ai-chat/access";
import Link from "next/link";
import {shouldShowFitness} from "@/lib/fitness/navigation";

export async function renderPlatformShell(children:React.ReactNode,fitness=false) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const loginPath=(await headers()).get("x-aifekr-path")?.split("?")[0]==="/play"?"/register?entry=chat&redirect=%2Fplay":"/login";

  if (!token) redirect(loginPath);
  const payload = verifyToken(token);
  if (!payload) redirect(loginPath);

  // Same bug as the root layout (see its comment): this used to fall back to
  // a hardcoded "fa" for a missing cookie, so an admin's "default_language"
  // site setting never reached the dashboard shell itself -- the root
  // layout's <html lang> could say "en" while every visible word in the
  // sidebar stayed Persian. getServerLang() is the one place that correctly
  // checks the DB setting.
  const lang = await getServerLang();

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role:true, fitnessAccessExpiry:true,accountType:true,chatOnly:true, name: true, credits: true, plan: true, planExpiry: true, isBlocked: true, industryPackId: true, crmPlan: true, crmPlanExpiry: true, onboardingDone: true, trialEndsAt: true, trialLimited: true, activeBusinessId: true, fitnessProfile: { select: { userId: true } } },
  });

  if (!user || user.isBlocked) redirect("/login");
  if((await headers()).get("x-aifekr-path")?.split("?")[0]==="/play")return <div className="min-h-screen"><nav className="border-b p-4 flex gap-5"><Link href="/">AIFekr</Link><Link href="/chat">AI Chat</Link></nav><main>{children}</main></div>;
  if(standaloneChatOnly(user)){const path=(await headers()).get("x-aifekr-path")?.split("?")[0]||"";if(!["/play","/settings","/profile","/payments","/referral","/credits"].some(p=>path===p||path.startsWith(p+"/")))redirect("/chat");return <div className="min-h-screen"><nav className="border-b p-4"><Link href="/chat">AIFekr AI Chat</Link></nav><main>{children}</main></div>;}
  if (!fitness && user.accountType === "FITNESS" && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) redirect("/fitness");

  // Redirect new users to onboarding wizard (welcome is outside this layout group)
  if (!fitness && !user.onboardingDone) redirect("/welcome");

  // If this user has joined a team (as owner or member), the sidebar should
  // show the shared team credit pool instead of user.credits — actual
  // deduction already goes through the pool, see src/lib/utils/teamCredits.ts.
  const teamMembership = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    include: { team: { select: { credits: true,planExpiry:true,owner:{select:{planExpiry:true}} } } },
  });
  const teamExpiry=teamFeatureExpiry(teamMembership?.team);
  const expired=!fitness && featureAccessExpired(user,teamExpiry);
  const expiresAt=(user.plan==="FREE"&&teamExpiry?teamExpiry:user.planExpiry||(user.plan==="FREE"?user.trialEndsAt:null))?.toISOString();
  // AIFekr FIT is a consumer product: offer it to people who use it or to
  // personal accounts, not as the second item in every business owner's menu.
  const crmActive = !!user.crmPlan && user.crmPlan !== "NONE" && (!user.crmPlanExpiry || user.crmPlanExpiry > new Date());
  const showFitness = shouldShowFitness({fitness,role:user.role,fitnessAccessExpiry:user.fitnessAccessExpiry,hasProfile:!!user.fitnessProfile,accountType:user.accountType,industryPackId:user.industryPackId,crmActive});
  const displayCredits = fitness ? user.credits : teamMembership?.team.credits ?? user.credits;
  const pendingPaymentCount = await prisma.payment.count({ where: { userId: user.id, status: "PENDING" } });
  const studentWorkspaceEnabled = await isStudentWorkspaceEnabled(user);
  const showTrialBanner = shouldShowTrialBanner({ trialEndsAt: user.trialEndsAt, plan: user.plan, planExpiry: user.planExpiry });

  // tool: "support" tags the floating support assistant's own conversations
  // (see src/lib/orchestrator/support -- same reuse-Conversation/Message
  // pattern the image/CEO/meeting chats already use, distinguished the same
  // way via Conversation.tool). Excluded here so a user's "where do I find
  // invoices" threads never show up mixed into their real chat history.
  const conversations = await prisma.conversation.findMany({
    where: chatHistoryWhere(user.id, user.activeBusinessId),
    select: { id: true, title: true, updatedAt: true, projectId: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

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
