import type { Lang } from "@/lib/i18n";
import { resolveCrmWorkspace, hasCrmAccess, agentFilter, dealAgentFilter } from "@/lib/crm/workspace";

/**
 * The isolation boundary for `full_mode` — what stands in for the row-level
 * security the master prompt (§3.2) assumes and this stack does not have.
 *
 * Phase 0 established there is no Supabase and no Postgres RLS here: tenant
 * isolation is application-level, enforced by `requireAuth()` plus an explicit
 * scope on every query. Phase 1's rules, implemented here:
 *
 *   Rule 1 — the orchestrator never sees a raw session user id. Tools accept
 *   a `WorkspaceContext`, never a bare string, so a tool physically cannot
 *   query "some other user": it is not given one.
 *
 *   Rule 2 — intra-tenant restriction is honoured, not just tenant isolation.
 *   This is the likeliest way this feature could introduce a real
 *   vulnerability. `resolveCrmWorkspace()` marks a team member with the AGENT
 *   role `isAgentRestricted`, and every CRM route today additionally filters
 *   to records assigned to them. An orchestrator that scoped only by
 *   `workspaceUserId` would look correctly tenant-isolated while letting a
 *   junior agent ask the chat "list every open deal" and receive the whole
 *   agency's pipeline. So the context carries the same `agentFilter`/
 *   `dealAgentFilter` fragments the routes use, and CRM read tools spread
 *   them in.
 *
 *   Rule 3 — ids remembered across turns are re-validated, never trusted.
 *   Tools re-query with `{ id, userId: ctx.workspaceUserId }` and treat a
 *   miss as not-found, so a stale id from a workspace the user has since left
 *   resolves to nothing rather than to data.
 */

export interface WorkspaceContext {
  /** The user id all workspace data is scoped to — the workspace owner, not necessarily the session user. */
  workspaceUserId: string;
  /** Verified active business boundary for business-scoped CRM records. */
  businessId?: string | null;
  /** The logged-in user. Distinct from workspaceUserId for team members. */
  actingUserId: string;
  /** True when queries must additionally be restricted to this user's own assigned records. */
  isAgentRestricted: boolean;
  /** "NONE" | "SOLO" | "TEAM" — the workspace owner's CRM add-on tier, expiry already applied. */
  crmPlan: string;
  /** The session user's main plan, expiry already applied by requireAuth(). */
  plan: string;
  voicePlan: string | null;
  lang: Lang;
  /** Prisma `where` fragment restricting CrmContact queries for a restricted agent. */
  contactFilter: ReturnType<typeof agentFilter>;
  /** Prisma `where` fragment restricting CrmDeal queries (uses `ownerId`, not `assignedToId`). */
  dealFilter: ReturnType<typeof dealAgentFilter>;
  /** `{ businessId }` for the verified active business, or `{}` for a not-yet-provisioned legacy account. Spread into EVERY business-scoped query a tool makes. */
  businessFilter: { businessId?: string };
}

export interface SessionUserLike {
  id: string;
  plan: string;
  voicePlan?: string | null;
}

/**
 * Builds the one context object every `full_mode` tool call is given.
 *
 * Takes the already-authenticated user object (from `requireAuth()`) rather
 * than an id, so there is no path where a caller passes an arbitrary id it
 * did not authenticate.
 */
export async function buildWorkspaceContext(user: SessionUserLike, lang: Lang): Promise<WorkspaceContext> {
  const ws = await resolveCrmWorkspace(user.id);

  return {
    workspaceUserId: ws.workspaceUserId,
    businessId: ws.businessId,
    actingUserId: ws.actingUserId,
    isAgentRestricted: ws.isAgentRestricted,
    crmPlan: ws.crmPlan,
    plan: user.plan,
    voicePlan: user.voicePlan ?? null,
    lang,
    contactFilter: agentFilter(ws),
    dealFilter: dealAgentFilter(ws),
    businessFilter: ws.businessId ? { businessId: ws.businessId } : {},
  };
}

/**
 * Whether the paid CRM surfaces (invoices, contracts, automation, the CRM
 * agent, accounting) are available in this workspace. Delegates to the same
 * `hasCrmAccess()` the routes use rather than re-deriving the rule, so the
 * orchestrator can never be more permissive than the pages it acts on behalf of.
 */
export function contextHasCrmAccess(ctx: WorkspaceContext): boolean {
  return hasCrmAccess({
    workspaceUserId: ctx.workspaceUserId,
    actingUserId: ctx.actingUserId,
    crmRole: ctx.isAgentRestricted ? "AGENT" : "OWNER",
    isAgentRestricted: ctx.isAgentRestricted,
    crmPlan: ctx.crmPlan,
    businessId: ctx.businessId ?? null,
  });
}
