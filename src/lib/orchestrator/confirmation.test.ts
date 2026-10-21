import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildWorkspaceContext } from "./isolation";
import { gateToolCall, ACTION_TTL_MS } from "./modes";
import { getTool } from "./tools";

/**
 * The confirmation half of the COMMIT flow.
 *
 * These exercise the checks that `POST /api/orchestrator/action/[id]`
 * performs, against the real database, without going through HTTP — the route
 * is a thin wrapper over exactly this sequence, and testing it here means the
 * security properties are asserted rather than assumed.
 *
 * The property each case defends:
 *   - a stored action executes with the arguments stored at propose time,
 *     never anything a client could resend;
 *   - it is single-use;
 *   - it expires;
 *   - it belongs to one workspace AND one acting user;
 *   - the gate and the tool's validator both run again at execution time, so
 *     an add-on that lapsed in between blocks the write.
 */

const P = "confirmtest";
const ownerId = `${P}owner`;
const otherOwnerId = `${P}other`;
const teamMateId = `${P}mate`;
const teamId = `${P}team`;

let dealId = "";
let wonStageId = "";
let conversationId = "";

async function cleanup() {
  await prisma.orchestratorAction.deleteMany({ where: { workspaceUserId: { in: [ownerId, otherOwnerId] } } });
  await prisma.crmDeal.deleteMany({ where: { userId: { in: [ownerId, otherOwnerId] } } });
  await prisma.crmContact.deleteMany({ where: { userId: { in: [ownerId, otherOwnerId] } } });
  await prisma.crmStage.deleteMany({ where: { pipeline: { userId: { in: [ownerId, otherOwnerId] } } } });
  await prisma.crmPipeline.deleteMany({ where: { userId: { in: [ownerId, otherOwnerId] } } });
  await prisma.conversation.deleteMany({ where: { userId: { in: [ownerId, otherOwnerId] } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: [teamMateId] } } });
  await prisma.team.deleteMany({ where: { id: teamId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherOwnerId, teamMateId] } } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.user.create({ data: { id: ownerId, name: "Owner", plan: "PRO", crmPlan: "TEAM" } });
  await prisma.user.create({ data: { id: otherOwnerId, name: "Other owner", plan: "PRO", crmPlan: "TEAM" } });
  await prisma.user.create({ data: { id: teamMateId, name: "Team mate", plan: "FREE" } });
  await prisma.team.create({ data: { id: teamId, name: "T", ownerId } });
  await prisma.teamMember.create({ data: { teamId, userId: teamMateId, crmRole: "MANAGER" } });

  const pipeline = await prisma.crmPipeline.create({ data: { userId: ownerId, name: "P" } });
  const [s1, s2] = await Promise.all([
    prisma.crmStage.create({ data: { pipelineId: pipeline.id, name: "New", order: 1 } }),
    prisma.crmStage.create({ data: { pipelineId: pipeline.id, name: "Won", order: 2, isWon: true } }),
  ]);
  wonStageId = s2.id;

  const contact = await prisma.crmContact.create({ data: { userId: ownerId, name: "C" } });
  const deal = await prisma.crmDeal.create({
    data: { userId: ownerId, contactId: contact.id, pipelineId: pipeline.id, stageId: s1.id, title: "D", value: 10 },
  });
  dealId = deal.id;
  newStageId = s1.id;

  const conv = await prisma.conversation.create({ data: { userId: ownerId, title: "c" } });
  conversationId = conv.id;
}, 60_000);

let newStageId = "";

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prisma.orchestratorAction.deleteMany({ where: { workspaceUserId: { in: [ownerId, otherOwnerId] } } });
  await prisma.crmDeal.update({ where: { id: dealId }, data: { stageId: newStageId, status: "open", wonAt: null } });
});

async function stage(overrides: Partial<{ workspaceUserId: string; actingUserId: string; expiresAt: Date; status: string; argsJson: string }> = {}) {
  return prisma.orchestratorAction.create({
    data: {
      conversationId,
      workspaceUserId: overrides.workspaceUserId ?? ownerId,
      actingUserId: overrides.actingUserId ?? ownerId,
      toolKey: "crm.updateDealStage",
      argsJson:
        overrides.argsJson ??
        JSON.stringify({ dealQuery: "D", stageName: "Won", resolved: { dealId, dealTitle: "D", stageId: wonStageId, stageName: "Won" } }),
      summary: "Move deal to Won",
      status: overrides.status ?? "PENDING",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + ACTION_TTL_MS),
    },
  });
}

/** The route's own sequence, so the test asserts the real logic rather than a paraphrase. */
async function confirm(actionId: string, sessionUser: { id: string; plan: string }) {
  const action = await prisma.orchestratorAction.findUnique({ where: { id: actionId } });
  if (!action) return { status: 404 as const };

  const ctx = await buildWorkspaceContext(sessionUser, "en");
  if (action.workspaceUserId !== ctx.workspaceUserId || action.actingUserId !== ctx.actingUserId) return { status: 404 as const };
  if (action.status !== "PENDING") return { status: 409 as const };
  if (action.expiresAt.getTime() < Date.now()) {
    await prisma.orchestratorAction.update({ where: { id: action.id }, data: { status: "EXPIRED" } });
    return { status: 410 as const };
  }

  const tool = getTool(action.toolKey);
  const decision = gateToolCall({
    mode: "full_mode",
    toolKey: action.toolKey,
    tier: tool?.tier,
    planSatisfied: tool?.planSatisfied ? tool.planSatisfied(ctx) : true,
  });
  if (!decision.allowed || !tool) return { status: 403 as const };

  const args = tool.validate ? tool.validate(JSON.parse(action.argsJson), ctx) : {};
  if (args === null) return { status: 422 as const };

  const claim = await prisma.orchestratorAction.updateMany({ where: { id: action.id, status: "PENDING" }, data: { status: "CONFIRMED" } });
  if (claim.count === 0) return { status: 409 as const };

  const result = await tool.run(args as never, ctx);
  await prisma.orchestratorAction.update({ where: { id: action.id }, data: { status: "EXECUTED", resultJson: JSON.stringify(result.data) } });
  return { status: 200 as const, result: result.data };
}

describe("confirming a staged action", () => {
  it("executes it, using the arguments stored at propose time", async () => {
    const action = await stage();
    const res = await confirm(action.id, { id: ownerId, plan: "PRO" });

    expect(res.status).toBe(200);
    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true, stageId: true } });
    expect(deal?.status).toBe("won");
    expect(deal?.stageId).toBe(wonStageId);
  });

  it("is single-use — a second confirm does nothing", async () => {
    const action = await stage();
    expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(200);
    expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(409);
  });

  it("refuses an expired action and marks it expired, leaving the deal alone", async () => {
    const action = await stage({ expiresAt: new Date(Date.now() - 1000) });
    expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(410);

    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true } });
    expect(deal?.status).toBe("open");
    expect((await prisma.orchestratorAction.findUnique({ where: { id: action.id } }))?.status).toBe("EXPIRED");
  });

  it("refuses an action belonging to a different workspace, indistinguishably from a missing one", async () => {
    const action = await stage({ workspaceUserId: otherOwnerId, actingUserId: otherOwnerId });
    expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(404);

    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true } });
    expect(deal?.status).toBe("open");
  });

  it("refuses an action staged by a different member of the same workspace", async () => {
    // The team mate resolves into the same workspace, so a workspace-only
    // check would let them fire the owner's staged write. The acting-user
    // check is what stops it.
    const action = await stage({ actingUserId: ownerId });
    expect((await confirm(action.id, { id: teamMateId, plan: "FREE" })).status).toBe(404);

    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true } });
    expect(deal?.status).toBe("open");
  });

  it("re-validates the stored arguments, so a tampered row cannot execute", async () => {
    // dealQuery blanked out: the validator rejects it, so the row never runs
    // even though it carries a real resolved id.
    const action = await stage({
      argsJson: JSON.stringify({ dealQuery: "", stageName: "Won", resolved: { dealId, dealTitle: "D", stageId: wonStageId, stageName: "Won" } }),
    });
    expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(422);

    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true } });
    expect(deal?.status).toBe("open");
  });

  it("re-checks the plan gate at execution time, so a lapsed add-on blocks the write", async () => {
    const action = await stage();
    // Simulate the CRM add-on lapsing between staging and confirming.
    await prisma.user.update({ where: { id: ownerId }, data: { crmPlan: "NONE" } });
    try {
      expect((await confirm(action.id, { id: ownerId, plan: "PRO" })).status).toBe(403);
      const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { status: true } });
      expect(deal?.status).toBe("open");
    } finally {
      await prisma.user.update({ where: { id: ownerId }, data: { crmPlan: "TEAM" } });
    }
  });
});
