import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { deleteBusinessCompletely } from "./deleteBusiness";

/**
 * Deleting a business must remove every row scoped to it (not just the
 * BusinessWorkspace row), leave sibling businesses/organizations untouched,
 * reassign any user whose active business was the one deleted, and refuse to
 * remove an organization's last remaining business.
 */
const P = `delbiz${Date.now().toString(36)}`;
const ownerId = `${P}owner`;
const otherUserId = `${P}other`;
const orgId = `${P}org`;
const bizKeep = `${P}bizKeep`;
const bizGone = `${P}bizGone`;
const soloOrgId = `${P}soloOrg`;
const soloBizId = `${P}soloBiz`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: ownerId, name: "owner" } });
  await prisma.organization.create({ data: { id: orgId, name: "Org", slug: `${P}-org`, ownerId: ownerId } });
  await prisma.organizationMember.create({ data: { organizationId: orgId, userId: ownerId, role: "OWNER", allBusinesses: true } });
  await prisma.businessWorkspace.create({ data: { id: bizKeep, organizationId: orgId, createdById: ownerId, name: "Keep", slug: `${P}-keep` } });
  await prisma.businessWorkspace.create({ data: { id: bizGone, organizationId: orgId, createdById: ownerId, name: "Gone", slug: `${P}-gone` } });
  await prisma.user.update({ where: { id: ownerId }, data: { activeBusinessId: bizGone } });
  await prisma.crmContact.create({ data: { userId: ownerId, businessId: bizGone, name: "Contact in deleted business" } });
  await prisma.crmContact.create({ data: { userId: ownerId, businessId: bizKeep, name: "Contact in surviving business" } });
  await prisma.conversation.create({ data: { userId: ownerId, businessId: bizGone, title: "chat", model: "auto" } });

  await prisma.user.create({ data: { id: otherUserId, name: "other" } });
  await prisma.organization.create({ data: { id: soloOrgId, name: "SoloOrg", slug: `${P}-soloorg`, ownerId: otherUserId } });
  await prisma.organizationMember.create({ data: { organizationId: soloOrgId, userId: otherUserId, role: "OWNER", allBusinesses: true } });
  await prisma.businessWorkspace.create({ data: { id: soloBizId, organizationId: soloOrgId, createdById: otherUserId, name: "Solo", slug: `${P}-solo` } });
});

afterAll(async () => {
  await prisma.crmContact.deleteMany({ where: { userId: { in: [ownerId, otherUserId] } } });
  await prisma.conversation.deleteMany({ where: { userId: { in: [ownerId, otherUserId] } } });
  await prisma.businessWorkspace.deleteMany({ where: { organizationId: { in: [orgId, soloOrgId] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgId, soloOrgId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, soloOrgId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
});

describe("deleteBusinessCompletely", () => {
  it("refuses to delete an organization's only remaining business", async () => {
    const result = await deleteBusinessCompletely(soloBizId, otherUserId);
    expect(result).toEqual({ ok: false, reason: "last_business" });
    expect(await prisma.businessWorkspace.findUnique({ where: { id: soloBizId } })).not.toBeNull();
  });

  it("refuses a user with no membership on the organization", async () => {
    const result = await deleteBusinessCompletely(bizGone, otherUserId);
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("deletes the business, all its scoped data, reassigns the active user, and leaves siblings untouched", async () => {
    const result = await deleteBusinessCompletely(bizGone, ownerId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newActiveBusinessId).toBe(bizKeep);

    expect(await prisma.businessWorkspace.findUnique({ where: { id: bizGone } })).toBeNull();
    expect(await prisma.crmContact.count({ where: { businessId: bizGone } })).toBe(0);
    expect(await prisma.conversation.count({ where: { businessId: bizGone } })).toBe(0);

    expect(await prisma.businessWorkspace.findUnique({ where: { id: bizKeep } })).not.toBeNull();
    expect(await prisma.crmContact.count({ where: { businessId: bizKeep } })).toBe(1);

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    expect(owner?.activeBusinessId).toBe(bizKeep);
  });
});
