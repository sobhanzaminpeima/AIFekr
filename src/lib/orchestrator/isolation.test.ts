import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildWorkspaceContext } from "./isolation";
import { createOrganizationWithBusiness, grantBusinessAccess } from "@/lib/organization/provisioning";
import { crmPipelineSummary, crmRecentContacts, crmFollowUpsDue, crmUpdateDealStage } from "./tools/crm";

/**
 * Isolation tests against the real database — the Phase 5 security question
 * asked early, because it is cheaper to find a leak here than in a report.
 *
 * Two properties are asserted:
 *
 *   1. Cross-tenant: one workspace's tools never return another workspace's
 *      rows, and a COMMIT tool handed a foreign id refuses instead of writing.
 *
 *   2. Intra-tenant: a team member with the AGENT role sees only records
 *      assigned to them. This is the one most likely to be got wrong, because
 *      scoping by workspace alone *looks* correct — every CRM page enforces it
 *      via agentFilter()/dealAgentFilter(), so an orchestrator that skipped it
 *      would quietly become the one way in the product to read a colleague's
 *      pipeline.
 *
 * Fixtures are created and torn down around the suite; ids are namespaced so a
 * failed run leaves nothing that can be confused for real data.
 */

const P = "orctest";
const ownerAId = `${P}ownerA`;
const ownerBId = `${P}ownerB`;
const agentId = `${P}agent1`;
const teamId = `${P}team01`;

let dealOwnedByAgent = "";
let dealOwnedByColleague = "";
let dealInWorkspaceB = "";

async function cleanup() {
  await prisma.crmTask.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
  await prisma.crmDeal.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
  await prisma.crmContact.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
  await prisma.crmStage.deleteMany({ where: { pipeline: { userId: { in: [ownerAId, ownerBId] } } } });
  await prisma.crmPipeline.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: [agentId, ownerAId] } } });
  await prisma.team.deleteMany({ where: { id: teamId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, agentId] } } });
}

beforeAll(async () => {
  await cleanup();

  // Workspace A: owner on the TEAM tier, with one AGENT team member.
  await prisma.user.create({ data: { id: ownerAId, name: "Owner A", crmPlan: "TEAM", plan: "PRO" } });
  await prisma.user.create({ data: { id: ownerBId, name: "Owner B", crmPlan: "TEAM", plan: "PRO" } });
  await prisma.user.create({ data: { id: agentId, name: "Agent", plan: "FREE" } });
  await prisma.team.create({ data: { id: teamId, name: "Team A", ownerId: ownerAId } });
  await prisma.teamMember.create({ data: { teamId, userId: agentId, crmRole: "AGENT" } });

  // A team role alone never bridges a member into the owner's workspace (see
  // resolveCrmWorkspace) -- it takes an explicit, audited grant to the owner's
  // business. Every AGENT-role assertion below depends on that grant existing.
  const { business: businessA } = await createOrganizationWithBusiness({ ownerId: ownerAId, organizationName: "Org A", businessName: "Business A" });
  await grantBusinessAccess({ businessId: businessA.id, userId: agentId, role: "MEMBER", actorId: ownerAId });

  const [pipelineA, pipelineB] = await Promise.all([
    prisma.crmPipeline.create({ data: { userId: ownerAId, businessId: businessA.id, name: "Sales A" } }),
    prisma.crmPipeline.create({ data: { userId: ownerBId, name: "Sales B" } }),
  ]);
  const [stageA, stageA2, stageB] = await Promise.all([
    prisma.crmStage.create({ data: { pipelineId: pipelineA.id, name: "New", order: 1 } }),
    prisma.crmStage.create({ data: { pipelineId: pipelineA.id, name: "Won", order: 2, isWon: true } }),
    prisma.crmStage.create({ data: { pipelineId: pipelineB.id, name: "New", order: 1 } }),
  ]);

  // Two contacts in workspace A: one assigned to the agent, one not.
  const [contactAgent, contactColleague, contactB] = await Promise.all([
    prisma.crmContact.create({ data: { userId: ownerAId, businessId: businessA.id, name: "Agent's lead", assignedToId: agentId } }),
    prisma.crmContact.create({ data: { userId: ownerAId, businessId: businessA.id, name: "Colleague's lead" } }),
    prisma.crmContact.create({ data: { userId: ownerBId, name: "Other tenant's lead" } }),
  ]);

  const [d1, d2, d3] = await Promise.all([
    prisma.crmDeal.create({
      data: { userId: ownerAId, businessId: businessA.id, ownerId: agentId, contactId: contactAgent.id, pipelineId: pipelineA.id, stageId: stageA.id, title: "Agent deal", value: 100 },
    }),
    prisma.crmDeal.create({
      data: { userId: ownerAId, businessId: businessA.id, contactId: contactColleague.id, pipelineId: pipelineA.id, stageId: stageA.id, title: "Colleague deal", value: 900 },
    }),
    prisma.crmDeal.create({
      data: { userId: ownerBId, contactId: contactB.id, pipelineId: pipelineB.id, stageId: stageB.id, title: "Other tenant deal", value: 500 },
    }),
  ]);
  dealOwnedByAgent = d1.id;
  dealOwnedByColleague = d2.id;
  dealInWorkspaceB = d3.id;

  // Overdue tasks: one on the agent's contact, one on the colleague's.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.crmTask.createMany({
    data: [
      { userId: ownerAId, businessId: businessA.id, contactId: contactAgent.id, title: "Call agent's lead", dueDate: yesterday },
      { userId: ownerAId, businessId: businessA.id, contactId: contactColleague.id, title: "Call colleague's lead", dueDate: yesterday },
    ],
  });

  // Keep the stage id available to the COMMIT tests.
  wonStageA = stageA2.id;
  stageInWorkspaceB = stageB.id;
}, 60_000);

let wonStageA = "";
let stageInWorkspaceB = "";

afterAll(async () => {
  await cleanup();
});

describe("cross-tenant isolation", () => {
  it("never returns another workspace's contacts", async () => {
    const ctx = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    const result = await crmRecentContacts.run({ days: 365 }, ctx);
    const names = (result.data as { contacts: Array<{ name: string }> }).contacts.map((c) => c.name);

    expect(names).toContain("Agent's lead");
    expect(names).toContain("Colleague's lead");
    expect(names).not.toContain("Other tenant's lead");
  });

  it("cannot even resolve a deal that belongs to another workspace, so nothing is staged", async () => {
    const ctx = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    // Reference resolution is scoped, so another tenant's deal is simply not
    // findable — the leak is prevented before an action can be staged at all.
    const resolved = await crmUpdateDealStage.prepare!({ dealQuery: "Other tenant deal", stageName: "Won" }, ctx);
    expect(resolved).toBeNull();

    const untouched = await prisma.crmDeal.findUnique({ where: { id: dealInWorkspaceB }, select: { stageId: true, status: true } });
    expect(untouched?.stageId).toBe(stageInWorkspaceB);
    expect(untouched?.status).toBe("open");
  });

  it("refuses execution outright if a resolved id from elsewhere is somehow presented", async () => {
    const ctx = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    const result = await crmUpdateDealStage.run(
      { dealQuery: "x", stageName: "y", resolved: { dealId: dealInWorkspaceB, dealTitle: "x", stageId: wonStageA, stageName: "Won" } },
      ctx
    );

    expect((result.data as { updated: boolean }).updated).toBe(false);
    const untouched = await prisma.crmDeal.findUnique({ where: { id: dealInWorkspaceB }, select: { status: true } });
    expect(untouched?.status).toBe("open");
  });

  it("refuses to move a deal into a stage belonging to another pipeline", async () => {
    const ctx = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    const result = await crmUpdateDealStage.run(
      { dealQuery: "x", stageName: "y", resolved: { dealId: dealOwnedByColleague, dealTitle: "x", stageId: stageInWorkspaceB, stageName: "New" } },
      ctx
    );

    expect((result.data as { updated: boolean; reason?: string }).updated).toBe(false);
    expect((result.data as { reason?: string }).reason).toBe("stage_not_in_this_deal_pipeline");
  });
});

describe("intra-tenant isolation — the AGENT role", () => {
  it("resolves into the owner's workspace but marked restricted", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    expect(ctx.workspaceUserId).toBe(ownerAId);
    expect(ctx.actingUserId).toBe(agentId);
    expect(ctx.isAgentRestricted).toBe(true);
  });

  it("shows a restricted agent only their own contacts, not the whole workspace's", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    const result = await crmRecentContacts.run({ days: 365 }, ctx);
    const names = (result.data as { contacts: Array<{ name: string }> }).contacts.map((c) => c.name);

    expect(names).toContain("Agent's lead");
    expect(names).not.toContain("Colleague's lead");
    expect(names).not.toContain("Other tenant's lead");
  });

  it("does not hand a restricted agent workspace-wide pipeline totals", async () => {
    const agentCtx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    const ownerCtx = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");

    const agentView = (await crmPipelineSummary.run({}, agentCtx)).data as { openPipelineValue: number; scope: string };
    const ownerView = (await crmPipelineSummary.run({}, ownerCtx)).data as { openPipelineValue: number; scope: string };

    // The agent owns a 100-value deal; the workspace also holds a 900-value
    // deal that is not theirs. Seeing 1000 here would be the leak.
    expect(agentView.openPipelineValue).toBe(100);
    expect(agentView.scope).toMatch(/assigned to you/);
    expect(ownerView.openPipelineValue).toBe(1000);
  });

  it("shows a restricted agent only follow-ups on their own contacts", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    const result = await crmFollowUpsDue.run({}, ctx);
    const titles = (result.data as { tasks: Array<{ title: string }> }).tasks.map((t) => t.title);

    expect(titles).toContain("Call agent's lead");
    expect(titles).not.toContain("Call colleague's lead");
  });

  it("cannot resolve a colleague's deal by name, and leaves it untouched", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    const before = await prisma.crmDeal.findUnique({ where: { id: dealOwnedByColleague }, select: { stageId: true } });

    expect(await crmUpdateDealStage.prepare!({ dealQuery: "Colleague deal", stageName: "Won" }, ctx)).toBeNull();

    const after = await prisma.crmDeal.findUnique({ where: { id: dealOwnedByColleague }, select: { stageId: true, status: true } });
    expect(after?.stageId).toBe(before?.stageId);
    expect(after?.status).toBe("open");
  });

  it("refuses execution on a colleague's deal even given its resolved id", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");
    const result = await crmUpdateDealStage.run(
      { dealQuery: "x", stageName: "y", resolved: { dealId: dealOwnedByColleague, dealTitle: "x", stageId: wonStageA, stageName: "Won" } },
      ctx
    );

    expect((result.data as { updated: boolean }).updated).toBe(false);
    const after = await prisma.crmDeal.findUnique({ where: { id: dealOwnedByColleague }, select: { status: true } });
    expect(after?.status).toBe("open");
  });

  it("allows the agent to resolve and move their own deal — the restriction is scoping, not a blanket block", async () => {
    const ctx = await buildWorkspaceContext({ id: agentId, plan: "FREE" }, "en");

    const resolved = await crmUpdateDealStage.prepare!({ dealQuery: "Agent deal", stageName: "Won" }, ctx);
    expect(resolved).not.toBeNull();
    expect(resolved!.resolved?.dealId).toBe(dealOwnedByAgent);

    const result = await crmUpdateDealStage.run(resolved!, ctx);
    expect((result.data as { updated: boolean }).updated).toBe(true);

    const after = await prisma.crmDeal.findUnique({ where: { id: dealOwnedByAgent }, select: { status: true, wonAt: true } });
    expect(after?.status).toBe("won");
    expect(after?.wonAt).not.toBeNull();
  });
});

describe("cross-BUSINESS isolation inside one workspace (an organization running several businesses)", () => {
  it("never lets an AI tool in one business read another business's contacts, and follows a business switch", async () => {
    const orgMember = await prisma.organizationMember.findFirstOrThrow({ where: { userId: ownerAId }, include: { organization: true } });
    const bizA = await prisma.businessWorkspace.findFirstOrThrow({ where: { organizationId: orgMember.organizationId } });
    const bizB = await prisma.businessWorkspace.create({
      data: { organizationId: orgMember.organizationId, createdById: ownerAId, name: "Business B", slug: `orctest-bizb-${Date.now()}` },
    });
    await prisma.businessMember.create({ data: { businessId: bizB.id, organizationMemberId: orgMember.id, userId: ownerAId, role: "OWNER" } });
    await prisma.crmContact.create({ data: { userId: ownerAId, businessId: bizB.id, name: "Business B's private lead" } });

    // Active business is A: B's lead must be invisible to the AI tool.
    const ctxA = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    expect(ctxA.businessId).toBe(bizA.id);
    const namesA = ((await crmRecentContacts.run({ days: 365 }, ctxA)).data as { contacts: Array<{ name: string }> }).contacts.map((c) => c.name);
    expect(namesA).toContain("Colleague's lead");
    expect(namesA).not.toContain("Business B's private lead");

    // Switch to B: now ONLY B's data.
    await prisma.user.update({ where: { id: ownerAId }, data: { activeBusinessId: bizB.id } });
    const ctxB = await buildWorkspaceContext({ id: ownerAId, plan: "PRO" }, "en");
    expect(ctxB.businessId).toBe(bizB.id);
    const namesB = ((await crmRecentContacts.run({ days: 365 }, ctxB)).data as { contacts: Array<{ name: string }> }).contacts.map((c) => c.name);
    expect(namesB).toEqual(["Business B's private lead"]);
  });
});
