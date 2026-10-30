import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { safeInternalPath } from "@/lib/growth/attribution";
import { featureAccessExpired, teamFeatureExpiry } from "@/lib/subscriptions/access";
import { chatHistoryWhere } from "@/lib/chat/history";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";
import { shouldShowTrialBanner } from "@/lib/subscriptions/trialBanner";
import { standaloneChatOnly } from "@/lib/ai-chat/access";
import { shouldShowFitness } from "@/lib/fitness/navigation";

/**
 * Everything the signed-in app frame decides before a page renders: where a
 * visitor must go instead (sign-in, onboarding, FIT, chat-only) and the data
 * the sidebar and banners show. Shared by the classic layout
 * (components/layout/PlatformShell) and the new design (/api/app/shell), so
 * both designs gate and count exactly the same way.
 */

const USER_SELECT = { id: true, role: true, fitnessAccessExpiry: true, accountType: true, chatOnly: true, name: true, credits: true, plan: true, planExpiry: true, isBlocked: true, industryPackId: true, crmPlan: true, crmPlanExpiry: true, onboardingDone: true, trialEndsAt: true, trialLimited: true, activeBusinessId: true, fitnessProfile: { select: { userId: true } } } as const;

export type ShellUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;
const loadUser = (id: string) => prisma.user.findUnique({ where: { id }, select: USER_SELECT });

/** Where the classic layout sends a visitor without a session, keeping the page they asked for. */
export function loginPathFor(requestedPath: string) {
  const returnTo = safeInternalPath(requestedPath);
  return requestedPath.split("?")[0] === "/play" ? "/register?entry=chat&redirect=%2Fplay" : returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : "/login";
}

export type ShellGate =
  | { kind: "redirect"; to: string }
  /** Special frames the classic layout renders itself (/play, chat-only accounts). */
  | { kind: "minimal"; frame: "play" | "chat-only"; user: ShellUser }
  | { kind: "full"; user: ShellUser };

export async function shellGate(token: string | undefined, requestedPath: string, fitness = false): Promise<ShellGate> {
  const loginPath = loginPathFor(requestedPath);
  if (!token) return { kind: "redirect", to: loginPath };
  const payload = verifyToken(token);
  if (!payload) return { kind: "redirect", to: loginPath };
  const user = await loadUser(payload.userId);
  if (!user || user.isBlocked) return { kind: "redirect", to: "/login" };
  const path = requestedPath.split("?")[0];
  if (path === "/play") return { kind: "minimal", frame: "play", user };
  if (standaloneChatOnly(user)) {
    // /chat itself stays: when the standalone chat is switched off, /chat renders
    // the regular chat in this frame instead of redirecting to itself forever.
    if (!["/chat", "/play", "/settings", "/profile", "/payments", "/referral", "/credits"].some(p => path === p || path.startsWith(p + "/"))) return { kind: "redirect", to: "/chat" };
    return { kind: "minimal", frame: "chat-only", user };
  }
  if (!fitness && user.accountType === "FITNESS" && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return { kind: "redirect", to: "/fitness" };
  // New users finish the onboarding wizard first (welcome is outside this layout group).
  if (!fitness && !user.onboardingDone) return { kind: "redirect", to: "/welcome" };
  return { kind: "full", user };
}

export async function shellData(user: ShellUser, fitness = false) {
  // A team member's sidebar shows the shared team pool; deduction already
  // goes through it (lib/utils/teamCredits).
  const teamMembership = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    include: { team: { select: { credits: true, planExpiry: true, owner: { select: { planExpiry: true } } } } },
  });
  const teamExpiry = teamFeatureExpiry(teamMembership?.team);
  const expired = !fitness && featureAccessExpired(user, teamExpiry);
  const expiresAt = (user.plan === "FREE" && teamExpiry ? teamExpiry : user.planExpiry || (user.plan === "FREE" ? user.trialEndsAt : null))?.toISOString();
  // AIFekr FIT is offered to people who use it or to personal accounts, not
  // as the second item in every business owner's menu.
  const crmActive = !!user.crmPlan && user.crmPlan !== "NONE" && (!user.crmPlanExpiry || user.crmPlanExpiry > new Date());
  const showFitness = shouldShowFitness({ fitness, role: user.role, fitnessAccessExpiry: user.fitnessAccessExpiry, hasProfile: !!user.fitnessProfile, accountType: user.accountType, industryPackId: user.industryPackId, crmActive });
  const displayCredits = fitness ? user.credits : teamMembership?.team.credits ?? user.credits;
  const pendingPaymentCount = await prisma.payment.count({ where: { userId: user.id, status: "PENDING" } });
  const studentWorkspaceEnabled = await isStudentWorkspaceEnabled(user);
  const showTrialBanner = shouldShowTrialBanner({ trialEndsAt: user.trialEndsAt, plan: user.plan, planExpiry: user.planExpiry });
  // tool "support" marks the floating support assistant's own threads, which
  // never appear in the chat history (lib/chat/history).
  const conversations = await prisma.conversation.findMany({
    where: chatHistoryWhere(user.id, user.activeBusinessId),
    select: { id: true, title: true, updatedAt: true, projectId: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return { expired, expiresAt, showFitness, displayCredits, pendingPaymentCount, studentWorkspaceEnabled, showTrialBanner, conversations };
}
