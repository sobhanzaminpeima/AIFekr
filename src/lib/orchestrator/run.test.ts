import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildWorkspaceContext } from "./isolation";
import { orchestrateTurn } from "./run";
import { emptyRoutingState, parseRoutingState, serializeRoutingState, resolveIntent } from "./routing";

/**
 * End-to-end lifecycle tests against the real database, with the planner
 * model stubbed.
 *
 * Stubbing the planner is the point, not a shortcut: it lets each test state
 * exactly what a model asked for — including things a model should never be
 * able to get away with — and assert what the server actually did about it.
 * A real model call would make these tests slow, flaky, and unable to
 * reproduce the adversarial cases at all.
 */

const P = "runtest";
const ownerId = `${P}owner1`;
let pipelineId = "";
let newStageId = "";
let wonStageId = "";
let dealId = "";
let conversationId = "";

/** A planner that always proposes exactly these calls, whatever it is asked. */
function stubPlanner(calls: Array<{ tool: string; args?: unknown }>) {
  return async () => JSON.stringify({ calls });
}

async function cleanup() {
  await prisma.orchestratorAction.deleteMany({ where: { workspaceUserId: ownerId } });
  await prisma.scheduledPost.deleteMany({ where: { userId: ownerId } });
  await prisma.crmTask.deleteMany({ where: { userId: ownerId } });
  await prisma.crmDeal.deleteMany({ where: { userId: ownerId } });
  await prisma.crmContact.deleteMany({ where: { userId: ownerId } });
  await prisma.crmStage.deleteMany({ where: { pipeline: { userId: ownerId } } });
  await prisma.crmPipeline.deleteMany({ where: { userId: ownerId } });
  await prisma.message.deleteMany({ where: { conversation: { userId: ownerId } } });
  await prisma.conversation.deleteMany({ where: { userId: ownerId } });
  await prisma.user.deleteMany({ where: { id: ownerId } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.user.create({ data: { id: ownerId, name: "Run Owner", plan: "PRO", crmPlan: "TEAM" } });

  const pipeline = await prisma.crmPipeline.create({ data: { userId: ownerId, name: "Sales" } });
  pipelineId = pipeline.id;
  const [s1, s2] = await Promise.all([
    prisma.crmStage.create({ data: { pipelineId, name: "New", order: 1 } }),
    prisma.crmStage.create({ data: { pipelineId, name: "Won", order: 2, isWon: true } }),
  ]);
  newStageId = s1.id;
  wonStageId = s2.id;

  const contact = await prisma.crmContact.create({ data: { userId: ownerId, name: "Acme Corp" } });
  const deal = await prisma.crmDeal.create({
    data: { userId: ownerId, contactId: contact.id, pipelineId, stageId: newStageId, title: "Acme renewal", value: 2500 },
  });
  dealId = deal.id;

  const conv = await prisma.conversation.create({ data: { userId: ownerId, title: "orchestrator run test" } });
  conversationId = conv.id;
}, 60_000);

afterAll(async () => {
  await cleanup();
});

async function ctx() {
  return buildWorkspaceContext({ id: ownerId, plan: "PRO" }, "en");
}

describe("intent resolution decides whether the orchestrator engages at all", () => {
  it("leaves ordinary chat completely alone when no business domain matches", async () => {
    const result = await orchestrateTurn({
      message: "write me a haiku about the sea",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.pipelineSummary", args: {} }]),
    });

    // Even though the stub planner would have proposed a CRM read, intent
    // resolution never asks it — a haiku request must not touch the CRM.
    expect(result.handled).toBe(false);
    expect(result.contextBlock).toBe("");
  });

  it("engages for a pipeline question and reads the real numbers", async () => {
    const result = await orchestrateTurn({
      message: "how is my sales pipeline doing?",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.pipelineSummary", args: {} }]),
    });

    expect(result.handled).toBe(true);
    expect(result.domains).toContain("crm");
    expect(result.contextBlock).toContain("2500");
    expect(result.sourceCapabilities).toContain("crm");
  });

  it("keeps a short follow-up in the previous domain", () => {
    expect(resolveIntent("and what about last month?", "accounting")).toEqual({ domains: ["accounting"], basis: "sticky" });
    expect(resolveIntent("and what about last month?", null).domains).toEqual([]);
  });

  it("routes a two-domain question to both domains", () => {
    const intent = resolveIntent("how many new leads this week, and what is scheduled on instagram?", null);
    expect(intent.domains).toContain("crm");
    expect(intent.domains).toContain("social");
  });
});

describe("the gate, on what a model actually asked for", () => {
  it("refuses an Instagram publish request and says so, instead of publishing", async () => {
    const before = await prisma.scheduledPost.count({ where: { userId: ownerId } });

    const result = await orchestrateTurn({
      message: "publish my instagram post now",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "social.publishPost", args: { postId: "whatever" } }]),
    });

    expect(result.handled).toBe(true);
    expect(result.rejectionBlock).toMatch(/never performed through the chat/i);
    expect(result.contextBlock).toBe("");
    expect(await prisma.scheduledPost.count({ where: { userId: ownerId } })).toBe(before);
  });

  it("drops a hallucinated tool and tells the composing model it was dropped", async () => {
    const result = await orchestrateTurn({
      message: "export my whole crm to a csv",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.exportEverything", args: {} }]),
    });

    expect(result.rejectionBlock).toMatch(/no such tool exists/i);
  });

  it("refuses accounting for a workspace with no CRM add-on, without reading anything", async () => {
    const freeCtx = { ...(await ctx()), crmPlan: "NONE" };
    const result = await orchestrateTurn({
      message: "what did I spend on expenses this month?",
      ctx: freeCtx,
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "accounting.recentExpenses", args: { days: 30 } }]),
    });

    expect(result.contextBlock).toBe("");
    expect(result.rejectionBlock).toMatch(/plan or add-on/i);
  });
});

describe("the DRAFT tier writes only drafts", () => {
  it("queues an Instagram post that will not publish itself", async () => {
    const result = await orchestrateTurn({
      message: "draft an instagram post about our new listing",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "social.draftPost", args: { caption: "New listing just dropped", hashtags: "#realestate" } }]),
    });

    expect(result.handled).toBe(true);

    const post = await prisma.scheduledPost.findFirst({ where: { userId: ownerId }, orderBy: { createdAt: "desc" } });
    expect(post?.caption).toBe("New listing just dropped");
    // The whole locked rule in one assertion: the publish cron only fires on
    // mode "auto", so a manual-mode post cannot publish on its own.
    expect(post?.mode).toBe("manual");
    expect(post?.status).toBe("PENDING");
  });

  it("creates a follow-up task without touching any deal or contact", async () => {
    const dealBefore = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { stageId: true, updatedAt: true } });

    await orchestrateTurn({
      message: "remind me to follow up with that lead",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.draftFollowUpTask", args: { title: "Call Acme back", dueInDays: 2 } }]),
    });

    const task = await prisma.crmTask.findFirst({ where: { userId: ownerId }, orderBy: { createdAt: "desc" } });
    expect(task?.title).toBe("Call Acme back");
    expect(task?.autoGenerated).toBe(true);

    const dealAfter = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { stageId: true } });
    expect(dealAfter?.stageId).toBe(dealBefore?.stageId);
  });
});

describe("the COMMIT tier stages, and does not execute", () => {
  it("stores a PENDING action and changes nothing yet", async () => {
    const result = await orchestrateTurn({
      message: "move the Acme deal to won",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.updateDealStage", args: { dealQuery: "Acme renewal", stageName: "Won" } }]),
    });

    expect(result.pendingActions).toHaveLength(1);
    const card = result.pendingActions[0];
    expect(card.toolKey).toBe("crm.updateDealStage");
    expect(card.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const stored = await prisma.orchestratorAction.findUnique({ where: { id: card.id } });
    expect(stored?.status).toBe("PENDING");
    expect(stored?.workspaceUserId).toBe(ownerId);
    // The card text is stored server-side, built from the resolved args, so it
    // names the real deal and stage rather than echoing the model.
    expect(stored?.summary).toBe(card.summary);
    expect(card.summary).toContain("Acme renewal");
    expect(card.summary).toContain("Won");
    // The stored args carry the ids prepare() resolved, not model text.
    expect(JSON.parse(stored!.argsJson).resolved.dealId).toBe(dealId);

    // Crucially: the deal has not moved.
    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { stageId: true, status: true } });
    expect(deal?.stageId).toBe(newStageId);
    expect(deal?.status).toBe("open");
  });

  it("records the acting user, so one team member cannot later confirm another's staged write", async () => {
    const result = await orchestrateTurn({
      message: "move the Acme deal to won",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.updateDealStage", args: { dealQuery: "Acme renewal", stageName: "Won" } }]),
    });

    const stored = await prisma.orchestratorAction.findUnique({ where: { id: result.pendingActions[0].id } });
    expect(stored?.actingUserId).toBe(ownerId);
  });
});

describe("routing state", () => {
  it("remembers the domain and any ids it surfaced, bounded", async () => {
    const result = await orchestrateTurn({
      message: "which deals have gone quiet in my pipeline?",
      ctx: await ctx(),
      state: emptyRoutingState(),
      conversationId,
      callPlanner: stubPlanner([{ tool: "crm.pipelineSummary", args: {} }]),
    });

    expect(result.nextState.lastDomain).toBe("crm");
    expect(result.nextState.entities.length).toBeLessThanOrEqual(8);
  });

  it("survives a round-trip through the database column", () => {
    const state = { lastDomain: "accounting" as const, entities: [{ domain: "accounting" as const, kind: "expense", id: "abc123", label: "Rent" }] };
    expect(parseRoutingState(serializeRoutingState(state))).toEqual(state);
  });

  it("recovers to an empty state from corrupted or foreign JSON rather than throwing", () => {
    expect(parseRoutingState("not json at all")).toEqual(emptyRoutingState());
    expect(parseRoutingState('{"lastDomain":"hacked","entities":"nope"}')).toEqual(emptyRoutingState());
  });
});
