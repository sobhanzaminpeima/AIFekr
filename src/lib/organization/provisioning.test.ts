import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createOrganizationWithBusiness, grantBusinessAccess, revokeBusinessAccess } from "./provisioning";
import { resolveOrganizationContext } from "./context";

const P = `orgprov${Date.now().toString(36)}`;
const ownerId = `${P}owner`;
const staffId = `${P}staff`;
const outsiderId = `${P}outsider`;
let businessId = "";
let secondBusinessId = "";

beforeAll(async () => {
  for (const id of [ownerId, staffId, outsiderId]) await prisma.user.create({ data: { id, name: id } });
  const first = await createOrganizationWithBusiness({ ownerId, organizationName: "Prov Org", businessName: "First" });
  businessId = first.business.id;
  // A second business inside the SAME organization, to prove a grant to one never leaks to the other.
  const second = await prisma.businessWorkspace.create({
    data: { organizationId: first.organization.id, createdById: ownerId, name: "Second", slug: `${P}-second` },
  });
  secondBusinessId = second.id;
}, 60_000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, staffId, outsiderId] } } });
});

describe("grantBusinessAccess", () => {
  it("lets a granted user resolve that business, and only that business", async () => {
    await grantBusinessAccess({ businessId, userId: staffId, role: "MEMBER", actorId: ownerId });

    expect(await resolveOrganizationContext(staffId, businessId)).not.toBeNull();
    expect(await resolveOrganizationContext(staffId, secondBusinessId)).toBeNull();
  });

  it("never widens an existing member to all businesses", async () => {
    await grantBusinessAccess({ businessId, userId: staffId, role: "MANAGER", actorId: ownerId });
    const member = await prisma.organizationMember.findFirst({ where: { userId: staffId } });
    expect(member?.allBusinesses).toBe(false);
  });

  it("is idempotent: retrying creates one grant, not two", async () => {
    await grantBusinessAccess({ businessId, userId: staffId, role: "MEMBER", actorId: ownerId });
    await grantBusinessAccess({ businessId, userId: staffId, role: "MEMBER", actorId: ownerId });
    expect(await prisma.businessMember.count({ where: { businessId, userId: staffId } })).toBe(1);
  });

  it("gives an unrelated user no access at all", async () => {
    expect(await resolveOrganizationContext(outsiderId, businessId)).toBeNull();
  });

  it("writes an audit log entry for the grant", async () => {
    const entries = await prisma.organizationAuditLog.count({ where: { businessId, action: "business.access_granted", targetId: staffId } });
    expect(entries).toBeGreaterThan(0);
  });

  it("refuses to grant into a business that does not exist", async () => {
    await expect(grantBusinessAccess({ businessId: "nope", userId: staffId })).rejects.toThrow();
  });
});

describe("revokeBusinessAccess", () => {
  it("removes access immediately", async () => {
    await grantBusinessAccess({ businessId, userId: staffId, actorId: ownerId });
    expect(await resolveOrganizationContext(staffId, businessId)).not.toBeNull();

    await revokeBusinessAccess({ businessId, userId: staffId, actorId: ownerId });
    expect(await resolveOrganizationContext(staffId, businessId)).toBeNull();
  });
});

describe("account deletion", () => {
  it("can delete a user who created a business (regression: createdById used to be ON DELETE RESTRICT)", async () => {
    const creatorId = `${P}creator`;
    await prisma.user.create({ data: { id: creatorId, name: "creator" } });
    const { business } = await createOrganizationWithBusiness({ ownerId: creatorId, organizationName: "Delete Me", businessName: "Gone" });
    expect(business.id).toBeTruthy();

    await expect(prisma.user.delete({ where: { id: creatorId } })).resolves.toBeTruthy();
  });
});
