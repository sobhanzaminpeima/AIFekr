import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { recordOrganizationCredit } from "./credits";
import { resolveOrganizationContext } from "./context";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ownerId = `org-test-owner-${suffix}`;
const memberId = `org-test-member-${suffix}`;
let organizationId = "";
let permittedBusinessId = "";
let forbiddenBusinessId = "";

beforeAll(async () => {
  await prisma.user.createMany({ data: [{ id: ownerId, name: "Org owner" }, { id: memberId, name: "Restricted member" }] });
  const org = await prisma.organization.create({ data: { name: "Test Organization", slug: `test-org-${suffix}`, ownerId, aiCredits: 20 } });
  organizationId = org.id;
  const owner = await prisma.organizationMember.create({ data: { organizationId, userId: ownerId, role: "OWNER", allBusinesses: true } });
  const member = await prisma.organizationMember.create({ data: { organizationId, userId: memberId, role: "MEMBER", allBusinesses: false } });
  const permitted = await prisma.businessWorkspace.create({ data: { organizationId, name: "Permitted", slug: `permitted-${suffix}`, createdById: ownerId } });
  const forbidden = await prisma.businessWorkspace.create({ data: { organizationId, name: "Forbidden", slug: `forbidden-${suffix}`, createdById: ownerId } });
  permittedBusinessId = permitted.id;
  forbiddenBusinessId = forbidden.id;
  await prisma.businessMember.createMany({ data: [
    { businessId: permitted.id, organizationMemberId: owner.id, userId: ownerId, role: "OWNER" },
    { businessId: forbidden.id, organizationMemberId: owner.id, userId: ownerId, role: "OWNER" },
    { businessId: permitted.id, organizationMemberId: member.id, userId: memberId, role: "MEMBER" },
  ] });
});

afterAll(async () => {
  await prisma.user.updateMany({ where: { id: { in: [ownerId, memberId] } }, data: { activeBusinessId: null } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
});

describe("organization context isolation", () => {
  it("allows an explicit business grant and rejects a sibling business", async () => {
    const allowed = await resolveOrganizationContext(memberId, permittedBusinessId);
    const denied = await resolveOrganizationContext(memberId, forbiddenBusinessId);
    expect(allowed?.businessId).toBe(permittedBusinessId);
    expect(denied).toBeNull();
  });

  it("allows an organization owner across every active business", async () => {
    const context = await resolveOrganizationContext(ownerId, forbiddenBusinessId);
    expect(context?.role).toBe("OWNER");
    expect(context?.allBusinesses).toBe(true);
  });
});

describe("organization credit ledger", () => {
  it("atomically prevents two concurrent spends from overdrawing the pool", async () => {
    const attempts = await Promise.all([
      recordOrganizationCredit({ organizationId, businessId: permittedBusinessId, userId: ownerId, resourceType: "AI_CREDIT", direction: "USAGE", amount: -15, idempotencyKey: `a-${suffix}` }),
      recordOrganizationCredit({ organizationId, businessId: permittedBusinessId, userId: ownerId, resourceType: "AI_CREDIT", direction: "USAGE", amount: -15, idempotencyKey: `b-${suffix}` }),
    ]);
    expect(attempts.filter((attempt) => attempt.applied)).toHaveLength(1);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    expect(org.aiCredits).toBe(5);
  });

  it("does not charge twice for the same idempotency key", async () => {
    const input = { organizationId, businessId: permittedBusinessId, userId: ownerId, resourceType: "AI_CREDIT" as const, direction: "USAGE" as const, amount: -2, idempotencyKey: `idempotent-${suffix}` };
    const first = await recordOrganizationCredit(input);
    const second = await recordOrganizationCredit(input);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
  });
});
