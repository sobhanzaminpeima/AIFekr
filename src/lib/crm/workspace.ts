import { prisma } from "@/lib/db/prisma";

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
    const owner = await prisma.user.findUnique({ where: { id: membership.team.ownerId }, select: { crmPlan: true } });
    if (owner?.crmPlan === "TEAM") {
      const role = membership.crmRole as CrmRole;
      return {
        workspaceUserId: membership.team.ownerId,
        actingUserId: sessionUserId,
        crmRole: role,
        isAgentRestricted: role === "AGENT",
        crmPlan: owner.crmPlan,
      };
    }
  }

  const self = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { crmPlan: true } });
  return { workspaceUserId: sessionUserId, actingUserId: sessionUserId, crmRole: "OWNER", isAgentRestricted: false, crmPlan: self?.crmPlan || "NONE" };
}

/** Gate for the paid CRM surfaces — invoices, contracts, product catalog, automation, CRM Agent, team roles. Pipeline/Contacts/Activities/Tasks/Notes stay available on the free-trial contact cap (crmContactLimit) regardless of this. */
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
