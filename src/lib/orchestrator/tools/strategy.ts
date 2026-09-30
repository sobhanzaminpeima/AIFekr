import { buildBusinessSnapshot } from "@/lib/agents/businessSnapshot";
import { defineTool, type NoArgs, type ToolDefinition } from "./types";

/**
 * Strategy tools — read-only, by design.
 *
 * This wraps `buildBusinessSnapshot()`, the same already-`userId`-scoped
 * aggregator the CEO Orchestrator uses (Phase 0 found it to be the one
 * genuinely reusable part of `ceoOrchestrator.ts`). Nothing here writes, and
 * `ceoOrchestrator.ts` itself is untouched — the master prompt forbids
 * changing its behaviour, so this reads the same data rather than calling it.
 *
 * Note the cost asymmetry: this tool reads across every domain at once, so it
 * is the most expensive READ in the table. The planner's description says so,
 * to steer it towards the narrower per-domain tools for narrower questions.
 */

export const strategyBusinessSnapshot = defineTool<NoArgs>({
  key: "strategy.businessSnapshot",
  tier: "READ",
  capabilityKey: "ceo",
  description: "A cross-domain snapshot: sales pipeline, content, social, revenue, usage and accumulated business memory. Expensive — use only for genuinely whole-business questions ('how is my business doing overall'), not for a single-domain question.",
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const snap = await buildBusinessSnapshot(ctx.workspaceUserId);

    // Reshaped to the few figures a conversational answer actually needs, not
    // the whole snapshot object — the composing model does better with a small
    // set of pre-computed facts than a large dump it has to navigate.
    return {
      data: {
        businessDoctorAnalyses: snap.businessDoctor.totalAnalyses,
        latestBusinessProfile: snap.businessDoctor.latest
          ? { name: snap.businessDoctor.latest.businessName, industry: snap.businessDoctor.latest.industry }
          : null,
        articlesPublished: snap.content.totalPosts,
        socialPostsGenerated: snap.social.totalPosts,
        contacts: snap.sales.totalContacts,
        contactsNeedingFollowUp: snap.sales.needingFollowUp.length,
        openPipelineValue: snap.sales.pipelineValueOpen,
        openDeals: snap.sales.totalDealsOpen,
        winRate: snap.sales.winRate,
        revenueLast30d: snap.data.revenueLast30d,
        usageEventsLast30d: snap.data.usageEventsLast30d,
      },
      empty: snap.sales.totalContacts === 0 && snap.content.totalPosts === 0 && snap.social.totalPosts === 0,
    };
  },
});

export const STRATEGY_TOOLS: ToolDefinition<never>[] = [strategyBusinessSnapshot] as unknown as ToolDefinition<never>[];
