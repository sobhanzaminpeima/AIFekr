import { prisma } from "@/lib/db/prisma";
import { buildCrmSnapshot } from "@/lib/agents/crmSnapshot";
import { sanitizeFreeText } from "@/lib/agents/crmAgent";
import { contextHasCrmAccess } from "../isolation";
import { defineTool, validDays, validId, validText, type NoArgs, type ToolDefinition } from "./types";

/**
 * CRM tools (READ / DRAFT / COMMIT).
 *
 * Every query below carries two scopes, not one:
 *   `userId: ctx.workspaceUserId`  — tenant isolation
 *   `...ctx.contactFilter` / `...ctx.dealFilter` — intra-tenant restriction
 *
 * The second one is the easy one to forget and the expensive one to get
 * wrong: without it, a team member with the AGENT role could ask the chat to
 * list every deal and receive the whole agency's pipeline, even though every
 * CRM *page* correctly hides them (see src/lib/crm/workspace.ts). The
 * isolation test suite asserts this specifically.
 *
 * Contact and deal free text is passed through `sanitizeFreeText()` before it
 * can reach a prompt — some of it arrives from Instagram DMs and is untrusted
 * by the project's own locked rule.
 */

const crmAccess = contextHasCrmAccess;

export const crmPipelineSummary = defineTool<NoArgs>({
  key: "crm.pipelineSummary",
  tier: "READ",
  capabilityKey: "crm",
  description: "Open pipeline value, deal count, win rate, average sales cycle, stale deals and lead-source conversion. Use for 'how is my pipeline doing' style questions.",
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    // buildCrmSnapshot aggregates by workspace owner. For a restricted agent
    // those totals would include colleagues' deals, so they are not shown to
    // one — the per-agent read below is used instead.
    if (ctx.isAgentRestricted) {
      const [openDeals, contacts] = await Promise.all([
        prisma.crmDeal.findMany({
          where: { userId: ctx.workspaceUserId, ...ctx.businessFilter, status: "open", ...ctx.dealFilter },
          select: { value: true },
        }),
        prisma.crmContact.count({ where: { userId: ctx.workspaceUserId, ...ctx.businessFilter, ...ctx.contactFilter } }),
      ]);
      return {
        data: {
          scope: "only deals assigned to you",
          openDealCount: openDeals.length,
          openPipelineValue: openDeals.reduce((s, d) => s + d.value, 0),
          yourContacts: contacts,
        },
        empty: openDeals.length === 0 && contacts === 0,
      };
    }

    const snap = await buildCrmSnapshot(ctx.workspaceUserId, ctx.businessId);
    return {
      data: {
        scope: "whole workspace",
        openPipelineValue: snap.pipelineValueOpen,
        openDealCount: snap.totalDealsOpen,
        winRateLast90Days: snap.winRate,
        avgSalesCycleDays: snap.avgSalesCycleDays,
        totalContacts: snap.totalContacts,
        staleDeals: snap.staleDeals.map((d) => ({
          id: d.id,
          title: sanitizeFreeText(d.title),
          contact: sanitizeFreeText(d.contactName),
          daysSinceUpdate: d.daysSinceUpdate,
          value: d.value,
        })),
        leadSources: snap.leadSources,
      },
      empty: snap.totalContacts === 0 && snap.totalDealsOpen === 0,
    };
  },
});

export const crmRecentContacts = defineTool<{ days: number }>({
  key: "crm.recentContacts",
  tier: "READ",
  capabilityKey: "crm",
  description: "Contacts created in the last N days, with status and source. Use for 'how many new leads this week' style questions.",
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { days: validDays(o.days, 7) };
  },
  run: async (args, ctx) => {
    const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
    const contacts = await prisma.crmContact.findMany({
      where: { userId: ctx.workspaceUserId, ...ctx.businessFilter, createdAt: { gte: since }, ...ctx.contactFilter },
      select: { id: true, name: true, status: true, source: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const byStatus: Record<string, number> = {};
    for (const c of contacts) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

    return {
      data: {
        days: args.days,
        scope: ctx.isAgentRestricted ? "only contacts assigned to you" : "whole workspace",
        total: contacts.length,
        byStatus,
        contacts: contacts.slice(0, 15).map((c) => ({
          id: c.id,
          name: sanitizeFreeText(c.name),
          status: c.status,
          source: c.source,
        })),
      },
      empty: contacts.length === 0,
    };
  },
});

export const crmFollowUpsDue = defineTool<NoArgs>({
  key: "crm.followUpsDue",
  tier: "READ",
  capabilityKey: "crm",
  description: "Open tasks that are due or overdue, and contacts with no recent activity. Use for 'what should I follow up on' style questions.",
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const now = new Date();
    const tasks = await prisma.crmTask.findMany({
      where: {
        userId: ctx.workspaceUserId, ...ctx.businessFilter,
        status: { not: "done" },
        dueDate: { lte: now },
        // CrmTask carries no assignee of its own (only userId + an optional
        // contact), so a restricted agent is scoped through the contact's
        // assignment instead. Contact-less tasks are workspace-level and are
        // therefore excluded for a restricted agent rather than leaked.
        ...(ctx.isAgentRestricted ? { contact: { assignedToId: ctx.actingUserId } } : {}),
      },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    });

    return {
      data: {
        scope: ctx.isAgentRestricted ? "only tasks assigned to you" : "whole workspace",
        overdueTaskCount: tasks.length,
        tasks: tasks.map((t) => ({ id: t.id, title: sanitizeFreeText(t.title), dueDate: t.dueDate })),
      },
      empty: tasks.length === 0,
    };
  },
});

/**
 * DRAFT tier: writes a task, which is a reminder for the human — it changes
 * no deal, no contact, no money, and is trivially deleted. That is why it
 * doesn't need the COMMIT confirmation round-trip.
 */
export const crmDraftFollowUpTask = defineTool<{ title: string; contactId: string | null; dueInDays: number }>({
  key: "crm.draftFollowUpTask",
  tier: "DRAFT",
  capabilityKey: "crm",
  description: "Create an open follow-up task (a reminder for the user). Optionally attached to a contact. Does not message anyone.",
  planSatisfied: crmAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const title = validText(o.title, 200);
    if (!title) return null;
    return { title, contactId: validId(o.contactId), dueInDays: validDays(o.dueInDays, 3, 60) };
  },
  run: async (args, ctx) => {
    // Rule 3: an id carried over from an earlier turn is re-validated against
    // this workspace, so a stale or foreign id resolves to nothing.
    let contactId: string | null = null;
    if (args.contactId) {
      const contact = await prisma.crmContact.findFirst({
        where: { id: args.contactId, userId: ctx.workspaceUserId, ...ctx.businessFilter, ...ctx.contactFilter },
        select: { id: true },
      });
      contactId = contact?.id ?? null;
    }

    const task = await prisma.crmTask.create({
      data: {
        userId: ctx.workspaceUserId, ...ctx.businessFilter,
        contactId,
        title: args.title,
        dueDate: new Date(Date.now() + args.dueInDays * 24 * 60 * 60 * 1000),
        // Marked as machine-generated, the same way the CRM Agent's own
        // auto-created tasks are, so a user can tell at a glance which
        // reminders they wrote and which the assistant did.
        autoGenerated: true,
      },
      select: { id: true, title: true, dueDate: true },
    });

    return { data: { created: true, taskId: task.id, title: task.title, dueDate: task.dueDate, attachedToContact: contactId !== null } };
  },
});

/**
 * COMMIT tier: moving a deal between pipeline stages is real business state —
 * it changes forecasts, and a "won" stage can trigger downstream commission
 * and reporting logic. So it never runs in the turn that proposes it.
 */
interface UpdateDealStageArgs {
  /** What the user called the deal. Resolved to a real record in `prepare`. */
  dealQuery: string;
  /** What the user called the target stage. Resolved within that deal's own pipeline. */
  stageName: string;
  /** Filled in by `prepare` — never supplied by the model. */
  resolved?: { dealId: string; dealTitle: string; stageId: string; stageName: string };
}

export const crmUpdateDealStage = defineTool<UpdateDealStageArgs>({
  key: "crm.updateDealStage",
  tier: "COMMIT",
  capabilityKey: "crm",
  description:
    "Move one deal to a different pipeline stage. Pass the deal and stage by the name the user used (e.g. dealQuery: 'Hilton renewal', stageName: 'Won') — do not pass ids. Requires the user to confirm before it runs.",
  planSatisfied: crmAccess,
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const dealQuery = validText(o.dealQuery, 120);
    const stageName = validText(o.stageName, 60);
    if (!dealQuery || !stageName) return null;

    // A stored action is re-validated at confirm time, and by then it also
    // carries what `prepare` resolved. Those ids must survive validation:
    // they are what the confirmation card described, so they — not a fresh
    // lookup that might now match a different deal — are what must execute.
    // Dropping them here made confirming a staged action fail every time with
    // "reference_not_resolved"; caught by confirmation.test.ts, which stays as
    // the regression guard. The ids are still re-read under the workspace
    // scope in `run`, so validating their shape is enough here.
    const r = o.resolved as Record<string, unknown> | undefined;
    if (r) {
      const dealId = validId(r.dealId);
      const stageId = validId(r.stageId);
      const dealTitle = validText(r.dealTitle, 200);
      const resolvedStageName = validText(r.stageName, 60);
      if (!dealId || !stageId || !dealTitle || !resolvedStageName) return null;
      return { dealQuery, stageName, resolved: { dealId, stageId, dealTitle, stageName: resolvedStageName } };
    }

    return { dealQuery, stageName };
  },
  /**
   * Resolves both references under the workspace scope (and the agent
   * restriction), refusing rather than guessing when the match is missing or
   * ambiguous. A user with two "Hilton" deals gets asked which one, instead
   * of the assistant silently picking.
   */
  prepare: async (args, ctx) => {
    const matches = await prisma.crmDeal.findMany({
      where: {
        userId: ctx.workspaceUserId, ...ctx.businessFilter,
        status: "open",
        title: { contains: args.dealQuery },
        ...ctx.dealFilter,
      },
      select: { id: true, title: true, pipelineId: true },
      take: 5,
    });
    // Exactly one match, or nothing: an ambiguous reference must not become a
    // silent choice between two real deals.
    if (matches.length !== 1) return null;
    const deal = matches[0];

    // The target stage is looked up inside that deal's own pipeline, so a
    // stage name that exists on a different board cannot be used to move a
    // deal across pipelines and corrupt both.
    const stages = await prisma.crmStage.findMany({
      where: { pipelineId: deal.pipelineId, name: { contains: args.stageName } },
      select: { id: true, name: true },
      take: 5,
    });
    if (stages.length !== 1) return null;

    return {
      ...args,
      resolved: { dealId: deal.id, dealTitle: sanitizeFreeText(deal.title), stageId: stages[0].id, stageName: stages[0].name },
    };
  },
  summarize: (args, _ctx, lang) => {
    // Built from what `prepare` resolved, so the card names the actual deal
    // and stage that confirming will change — not whatever the model wrote.
    const r = args.resolved;
    if (!r) return args.dealQuery;
    if (lang === "fa") return `معاملهٔ «${r.dealTitle}» به مرحلهٔ «${r.stageName}» منتقل شود`;
    if (lang === "de") return `Deal „${r.dealTitle}" in die Phase „${r.stageName}" verschieben`;
    return `Move the deal "${r.dealTitle}" to the "${r.stageName}" stage`;
  },
  run: async (args, ctx) => {
    if (!args.resolved) return { data: { updated: false, reason: "reference_not_resolved" } };

    // Re-read under the workspace scope at execution time: minutes may have
    // passed since the reference was resolved, and the deal may have been
    // reassigned or deleted in between.
    const deal = await prisma.crmDeal.findFirst({
      where: { id: args.resolved.dealId, userId: ctx.workspaceUserId, ...ctx.businessFilter, ...ctx.dealFilter },
      select: { id: true, title: true, pipelineId: true },
    });
    if (!deal) return { data: { updated: false, reason: "deal_not_found_in_this_workspace" } };

    const stage = await prisma.crmStage.findFirst({
      where: { id: args.resolved.stageId, pipelineId: deal.pipelineId },
      select: { id: true, name: true, isWon: true, isLost: true },
    });
    if (!stage) return { data: { updated: false, reason: "stage_not_in_this_deal_pipeline" } };

    await prisma.crmDeal.update({
      where: { id: deal.id },
      data: {
        stageId: stage.id,
        status: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
        wonAt: stage.isWon ? new Date() : null,
      },
    });

    return { data: { updated: true, dealTitle: sanitizeFreeText(deal.title), newStage: stage.name } };
  },
});

/**
 * READ companion to the COMMIT tool above: lets the assistant tell the user
 * what their stage options actually are, so "move it forward" can become a
 * concrete request rather than a guess.
 */
export const crmOpenDeals = defineTool<{ query: string | null }>({
  key: "crm.openDeals",
  tier: "READ",
  capabilityKey: "crm",
  description: "List open deals (optionally filtered by a name fragment) with the stages available on their pipeline. Use when the user refers to a specific deal, or asks what stages exist.",
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { query: typeof o.query === "string" && o.query.trim() ? o.query.trim().slice(0, 120) : null };
  },
  run: async (args, ctx) => {
    const deals = await prisma.crmDeal.findMany({
      where: {
        userId: ctx.workspaceUserId, ...ctx.businessFilter,
        status: "open",
        ...(args.query ? { title: { contains: args.query } } : {}),
        ...ctx.dealFilter,
      },
      select: { id: true, title: true, value: true, stage: { select: { name: true } }, pipeline: { select: { stages: { select: { name: true }, orderBy: { order: "asc" } } } } },
      orderBy: { updatedAt: "desc" },
      take: 15,
    });

    return {
      data: {
        scope: ctx.isAgentRestricted ? "only deals assigned to you" : "whole workspace",
        count: deals.length,
        deals: deals.map((d) => ({
          id: d.id,
          title: sanitizeFreeText(d.title),
          value: d.value,
          currentStage: d.stage.name,
          stagesAvailable: d.pipeline.stages.map((s) => s.name),
        })),
      },
      empty: deals.length === 0,
    };
  },
});

export const CRM_TOOLS: ToolDefinition<never>[] = [
  crmPipelineSummary,
  crmRecentContacts,
  crmFollowUpsDue,
  crmOpenDeals,
  crmDraftFollowUpTask,
  crmUpdateDealStage,
] as unknown as ToolDefinition<never>[];
