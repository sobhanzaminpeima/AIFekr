import { prisma } from "@/lib/db/prisma";

function slugPart(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "workspace";
}

function uniqueSuffix() { return Math.random().toString(36).slice(2, 8); }

/** Creates an organization, its first workspace and the owner grants atomically. */
export async function createOrganizationWithBusiness(input: {
  ownerId: string; organizationName: string; businessName: string; industry?: string;
  country?: string; timezone?: string; currency?: string;
}) {
  const base = slugPart(input.organizationName);
  const organizationSlug = `${base}-${uniqueSuffix()}`;
  const businessSlug = `${slugPart(input.businessName)}-${uniqueSuffix()}`;
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName.trim(), slug: organizationSlug, ownerId: input.ownerId,
        industry: input.industry?.trim() || null, country: input.country || null,
        timezone: input.timezone || "UTC", currency: input.currency || "USD",
      },
    });
    const member = await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: input.ownerId, role: "OWNER", allBusinesses: true },
    });
    const business = await tx.businessWorkspace.create({
      data: {
        organizationId: organization.id, createdById: input.ownerId, name: input.businessName.trim(), slug: businessSlug,
        industry: input.industry?.trim() || null, country: input.country || null,
        timezone: input.timezone || "UTC", currency: input.currency || "USD",
      },
    });
    await tx.businessMember.create({ data: { businessId: business.id, organizationMemberId: member.id, userId: input.ownerId, role: "OWNER" } });
    await tx.user.update({ where: { id: input.ownerId }, data: { activeBusinessId: business.id } });
    await tx.organizationAuditLog.create({ data: { organizationId: organization.id, businessId: business.id, actorId: input.ownerId, action: "organization.created", targetType: "Organization", targetId: organization.id } });
    return { organization, business };
  });
}


/**
 * Grants an existing user access to ONE business, and only that business.
 * Idempotent (safe to retry) and audited. This is the only sanctioned way to
 * bridge a team member into someone else's workspace: resolveCrmWorkspace
 * refuses to honour a Team/crmRole on its own, so a team membership can never
 * silently leak one business's data into another.
 */
export async function grantBusinessAccess(input: {
  businessId: string; userId: string; role?: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER"; actorId?: string;
}) {
  const role = input.role || "MEMBER";
  return prisma.$transaction(async (tx) => {
    const business = await tx.businessWorkspace.findUnique({ where: { id: input.businessId }, select: { id: true, organizationId: true, status: true } });
    if (!business || business.status !== "ACTIVE") throw new Error("Business not found or not active");

    const member = await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: business.organizationId, userId: input.userId } },
      // allBusinesses is deliberately NOT touched on an existing row: granting one business must never widen access to all.
      update: { status: "ACTIVE" },
      create: { organizationId: business.organizationId, userId: input.userId, role, allBusinesses: false },
    });
    const grant = await tx.businessMember.upsert({
      where: { businessId_userId: { businessId: business.id, userId: input.userId } },
      update: { status: "ACTIVE", role },
      create: { businessId: business.id, organizationMemberId: member.id, userId: input.userId, role },
    });
    await tx.organizationAuditLog.create({
      data: { organizationId: business.organizationId, businessId: business.id, actorId: input.actorId || input.userId, action: "business.access_granted", targetType: "User", targetId: input.userId },
    });
    return grant;
  });
}

/** Revokes a user's grant to one business (soft: keeps the row for audit, status=REVOKED). */
export async function revokeBusinessAccess(input: { businessId: string; userId: string; actorId?: string }) {
  const grant = await prisma.businessMember.findUnique({ where: { businessId_userId: { businessId: input.businessId, userId: input.userId } }, include: { business: { select: { organizationId: true } } } });
  if (!grant) return null;
  await prisma.$transaction([
    prisma.businessMember.update({ where: { id: grant.id }, data: { status: "REVOKED" } }),
    prisma.organizationAuditLog.create({ data: { organizationId: grant.business.organizationId, businessId: input.businessId, actorId: input.actorId || input.userId, action: "business.access_revoked", targetType: "User", targetId: input.userId } }),
  ]);
  return grant;
}
