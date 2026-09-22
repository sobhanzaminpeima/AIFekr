import { prisma } from "@/lib/db/prisma";
import { defineTool, validFutureDate, validText, type NoArgs, type ToolDefinition } from "./types";

/**
 * Social / Instagram tools — READ and DRAFT only. There is no COMMIT tier
 * here and there never will be.
 *
 * ── The trap this file exists to avoid ──────────────────────────────────────
 * The master prompt's locked rule (§4) is that no Instagram post is ever
 * published automatically, "even through the chat". Honouring that is not
 * simply a matter of not calling the publish endpoint, because of how the
 * scheduling cron works:
 *
 *   src/app/api/cron/instagram-publish/route.ts selects
 *     { mode: "auto", status: "PENDING", scheduledFor: { lte: now } }
 *   and publishes every match to the real account with no human action.
 *
 * So a well-meaning "draft a post for me" tool that created a ScheduledPost
 * with mode "auto" would be an auto-publisher with extra steps — the post
 * would go out on its own at `scheduledFor`. That is exactly the silent
 * failure the rule is meant to prevent.
 *
 * Therefore `DRAFT_MODE` below is a hard-coded constant, never a parameter
 * the model or the caller can set, and a test asserts that no orchestrator
 * code path can produce an auto-mode post. A drafted post sits in the queue
 * until the user presses publish themselves on /social, which goes through
 * POST /api/social/instagram/publish with an explicit postId.
 */

/** Never `"auto"`. See the file comment — this single value is what keeps the locked no-auto-publish rule true for the chat. */
const DRAFT_MODE = "manual" as const;

export const socialConnectionStatus = defineTool<NoArgs>({
  key: "social.connectionStatus",
  tier: "READ",
  capabilityKey: "social",
  description: "Whether an Instagram account is connected, its username, and how many posts are queued or published. Use for 'is my Instagram connected' style questions.",
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const [conn, counts] = await Promise.all([
      prisma.instagramConnection.findFirst({
        where: { userId: ctx.workspaceUserId, ...ctx.businessFilter },
        select: { igUsername: true, tokenExpiry: true, createdAt: true },
      }),
      prisma.scheduledPost.groupBy({
        by: ["status"],
        where: { userId: ctx.workspaceUserId },
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of counts) byStatus[row.status] = row._count;

    return {
      data: {
        connected: !!conn,
        username: conn?.igUsername ?? null,
        tokenExpiresAt: conn?.tokenExpiry ?? null,
        postsByStatus: byStatus,
      },
      empty: !conn && counts.length === 0,
    };
  },
});

export const socialQueuedPosts = defineTool<NoArgs>({
  key: "social.queuedPosts",
  tier: "READ",
  capabilityKey: "social",
  description: "Posts currently waiting in the queue, with their scheduled time and whether they will publish automatically or need a manual press. Use for 'what is scheduled' style questions.",
  validate: () => ({}) as NoArgs,
  run: async (_args, ctx) => {
    const posts = await prisma.scheduledPost.findMany({
      where: { userId: ctx.workspaceUserId, status: "PENDING" },
      select: { id: true, caption: true, scheduledFor: true, mode: true, imageUrl: true, videoUrl: true },
      orderBy: { scheduledFor: "asc" },
      take: 20,
    });

    return {
      data: {
        pendingCount: posts.length,
        posts: posts.map((p) => ({
          id: p.id,
          // Captions are user- or AI-authored free text; the composing model
          // gets them framed as data, never as instructions (guard.ts).
          caption: p.caption.slice(0, 160),
          scheduledFor: p.scheduledFor,
          willPublishAutomatically: p.mode === "auto",
          hasMedia: !!(p.imageUrl || p.videoUrl),
        })),
      },
      empty: posts.length === 0,
    };
  },
});

/**
 * DRAFT tier: writes one queued post that will NOT publish itself.
 *
 * Two safeguards beyond `DRAFT_MODE`:
 *   - No media is attached, so even if something later flipped this row to
 *     auto mode, the publish path rejects a post with no image or video
 *     (Instagram's API cannot post text alone) — it would fail loudly rather
 *     than post something half-finished.
 *   - The result tells the model, in so many words, that the user still has
 *     to press publish, so the answer it composes says so too.
 */
export const socialDraftPost = defineTool<{ caption: string; hashtags: string; scheduledFor: Date }>({
  key: "social.draftPost",
  tier: "DRAFT",
  capabilityKey: "social",
  description: "Queue a draft Instagram post (caption + hashtags) for the user to review, add an image to, and publish themselves. It will never publish on its own.",
  validate: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const caption = validText(o.caption, 2200);
    if (!caption) return null;
    const hashtags = typeof o.hashtags === "string" ? o.hashtags.trim().slice(0, 500) : "";
    // Defaults to tomorrow when the model gives nothing usable — a draft needs
    // a scheduledFor value, and the column is non-null.
    const scheduledFor = validFutureDate(o.scheduledFor) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    return { caption, hashtags, scheduledFor };
  },
  run: async (args, ctx) => {
    const post = await prisma.scheduledPost.create({
      data: {
        userId: ctx.workspaceUserId,
        caption: args.caption,
        hashtags: args.hashtags,
        scheduledFor: args.scheduledFor,
        mode: DRAFT_MODE,
        status: "PENDING",
      },
      select: { id: true, scheduledFor: true },
    });

    return {
      data: {
        draftCreated: true,
        postId: post.id,
        scheduledFor: post.scheduledFor,
        willPublishAutomatically: false,
        userMustPublishManually: true,
        needsImageBeforePublishing: true,
        reviewAt: "/social",
      },
    };
  },
});

export const SOCIAL_TOOLS: ToolDefinition<never>[] = [
  socialConnectionStatus,
  socialQueuedPosts,
  socialDraftPost,
] as unknown as ToolDefinition<never>[];

/** Exported for the test that asserts the orchestrator can never queue an auto-publishing post. */
export const __DRAFT_MODE_FOR_TESTS = DRAFT_MODE;
