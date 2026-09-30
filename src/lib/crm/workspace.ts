import { prisma } from "@/lib/db/prisma";
import { resolveOrganizationContext } from "@/lib/organization/context";

export type CrmRole = "OWNER" | "MANAGER" | "AGENT";

export interface CrmWorkspace {
  /** The user id all CRM data is scoped to — the workspace owner, not necessarily the logged-in user. */
  workspaceUserId: string;
  /** The logged-in user's own id — used to filter to assignedToId when isAgentRestricted. */
  actingUserId: string;
  crmRole: CrmRole;
  /** True when this request must be additionally filtered to assignedToId = actingUserId. */
  isAgentRestricted: boolean;
  /** The workspace owner's CRM add-on tier — "NONE" | "SOLO" | "TEAM". Gates the paid CRM surfaces (billing, contracts, automation, AI agent, team roles); basic Pipeline/Contacts stay on the existing free-trial contact cap regardless. */
  crmPlan: string;
  /** Verified BusinessWorkspace boundary for new multi-business CRM reads. */
  businessId: string | null;
}

/**
 * Resolves which CRM workspace a logged-in user is acting in, and under what
 * role. Most users are the OWNER of their own workspace. A user who is a
 * TeamMember (not the team owner) with a crmRole set acts inside the team
 * owner's workspace instead — but only if that owner's crmPlan is "TEAM"
 * (a team can exist for AI-credit pooling without CRM ever being purchased).
 *
 * This is the sole gate for intra-tenant isolation: an AGENT must never see
 * another agent's leads/deals even inside the same workspace. Every CRM
 * route must call this and use workspaceUserId (not the raw session user id)
 * for its `userId` filter, and add `assignedToId: actingUserId` whenever
 * isAgentRestricted is true — enforced server-side, not just hidden in the UI.
 */
export async function resolveCrmWorkspace(sessionUserId: string): Promise<CrmWorkspace> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId: sessionUserId },
    include: { team: { select: { ownerId: true } } },
  });

  if (membership && membership.crmRole && membership.team.ownerId !== sessionUserId) {
    const owner = await prisma.user.findUnique({ where: { id: membership.team.ownerId }, select: { crmPlan: true, crmPlanExpiry: true, activeBusinessId: true } });
    if (owner?.crmPlan === "TEAM" && !isExpired(owner.crmPlanExpiry)) {
      // Team membership alone must never bridge two businesses. The migration
      // creates this grant for legacy teams; later invitations create it
      // explicitly. If no grant exists, keep the user in their own workspace.
      const grant = owner.activeBusinessId
        ? await prisma.businessMember.findUnique({ where: { businessId_userId: { businessId: owner.activeBusinessId, userId: sessionUserId } }, select: { id: true, status: true } })
        : null;
      if (!grant || grant.status !== "ACTIVE") {
        const selfContext = await resolveOrganizationContext(sessionUserId);
        const self = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { crmPlan: true, crmPlanExpiry: true } });
        const crmPlan = self && !isExpired(self.crmPlanExpiry) ? self.crmPlan || "NONE" : "NONE";
        return { workspaceUserId: sessionUserId, actingUserId: sessionUserId, crmRole: "OWNER", isAgentRestricted: false, crmPlan, businessId: selfContext?.businessId ?? null };
      }
      const role = membership.crmRole as CrmRole;
      return {
        workspaceUserId: membership.team.ownerId,
        actingUserId: sessionUserId,
        crmRole: role,
        isAgentRestricted: role === "AGENT",
        crmPlan: owner.crmPlan,
        businessId: owner.activeBusinessId,
      };
    }
  }

  const self = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { crmPlan: true, crmPlanExpiry: true } });
  const context = await resolveOrganizationContext(sessionUserId);
  const crmPlan = self && !isExpired(self.crmPlanExpiry) ? self.crmPlan || "NONE" : "NONE";
  return { workspaceUserId: sessionUserId, actingUserId: sessionUserId, crmRole: "OWNER", isAgentRestricted: false, crmPlan, businessId: context?.businessId ?? null };
}

/**
 * Scope new CRM queries to the verified active business. During the additive
 * migration this intentionally returns an empty fragment for accounts that
 * have not been provisioned yet; routes switch to it only after their data is
 * backfilled, avoiding a surprise lockout for legacy accounts.
 */
export function businessFilter(ws: CrmWorkspace): { businessId?: string } {
  return ws.businessId ? { businessId: ws.businessId } : {};
}

/** True once a stored expiry date has passed — null/undefined means no expiry (never purchased, or a non-expiring grant). */
function isExpired(expiry: Date | null | undefined): boolean {
  return !!expiry && expiry.getTime() < Date.now();
}

/** Gate for the paid CRM surfaces — invoices, contracts, product catalog, automation, CRM Agent, team roles. Pipeline/Contacts/Activities/Tasks/Notes stay available on the free-trial contact cap (crmContactLimit) regardless of this. Expiry is already folded into ws.crmPlan by resolveCrmWorkspace (an expired plan resolves to "NONE"), so this stays a plain plan check. */
export function hasCrmAccess(ws: CrmWorkspace): boolean {
  return ws.crmPlan !== "NONE";
}

/** Prisma `where` fragment restricting Contact/Deal queries to the acting agent's own assigned records, when applicable. Spread into a where clause: `{ ...ws.baseWhere(), ...agentFilter(ws) }`. */
export function agentFilter(ws: CrmWorkspace): { assignedToId?: string } | { ownerId?: string } {
  return ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {};
}

/** Same restriction for CrmDeal, which uses `ownerId` (assigned team member) rather than `assignedToId`. */
export function dealAgentFilter(ws: CrmWorkspace): { ownerId?: string } {
  return ws.isAgentRestricted ? { ownerId: ws.actingUserId } : {};
}
