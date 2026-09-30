import { prisma } from "@/lib/db/prisma";

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
export type OrganizationPermission =
  | "organization.manage" | "business.manage" | "team.manage" | "billing.manage"
  | "crm.view" | "crm.edit" | "content.manage" | "social.manage" | "analytics.view";

export type OrganizationContext = {
  organizationId: string;
  businessId: string;
  memberId: string;
  role: OrganizationRole;
  permissions: Set<string>;
  allBusinesses: boolean;
};

const ROLE_PERMISSIONS: Record<OrganizationRole, OrganizationPermission[]> = {
  OWNER: ["organization.manage", "business.manage", "team.manage", "billing.manage", "crm.view", "crm.edit", "content.manage", "social.manage", "analytics.view"],
  ADMIN: ["business.manage", "team.manage", "billing.manage", "crm.view", "crm.edit", "content.manage", "social.manage", "analytics.view"],
  MANAGER: ["crm.view", "crm.edit", "content.manage", "social.manage", "analytics.view"],
  MEMBER: ["crm.view", "content.manage"],
  VIEWER: ["crm.view", "analytics.view"],
};

function permissionsFrom(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === "string")) : new Set();
  } catch { return new Set(); }
}

/**
 * Resolves a requested business only after proving the signed-in user has an
 * active organization membership and either an all-business grant or an
 * explicit business membership. Never use a browser-supplied business id in a
 * data query without going through this function first.
 */
export async function resolveOrganizationContext(userId: string, requestedBusinessId?: string | null): Promise<OrganizationContext | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeBusinessId: true } });
  const businessId = requestedBusinessId || user?.activeBusinessId;
  if (!businessId) return null;

  const business = await prisma.businessWorkspace.findUnique({
    where: { id: businessId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!business || business.status !== "ACTIVE") return null;

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: business.organizationId, userId } },
    include: { businesses: { where: { businessId, userId, status: "ACTIVE" }, select: { permissions: true, role: true } } },
  });
  if (!member || member.status !== "ACTIVE") return null;

  const grant = member.businesses[0];
  if (!member.allBusinesses && !grant) return null;
  const role = (grant?.role || member.role) as OrganizationRole;
  const permissions = new Set<string>(ROLE_PERMISSIONS[role] || []);
  for (const permission of Array.from(permissionsFrom(grant?.permissions))) permissions.add(permission);
  return { organizationId: business.organizationId, businessId, memberId: member.id, role, permissions, allBusinesses: member.allBusinesses };
}

export function hasOrganizationPermission(context: OrganizationContext, permission: OrganizationPermission): boolean {
  return context.permissions.has(permission);
}

export function canManageOrganization(context: OrganizationContext): boolean {
  return context.role === "OWNER" || context.role === "ADMIN" || context.permissions.has("organization.manage");
}

export async function listAccessibleBusinesses(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true, planType: true, status: true } },
      businesses: { where: { status: "ACTIVE" }, include: { business: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const orgIdsWithGlobalAccess = memberships.filter((membership) => membership.allBusinesses).map((membership) => membership.organizationId);
  const globalBusinesses = orgIdsWithGlobalAccess.length
    ? await prisma.businessWorkspace.findMany({ where: { organizationId: { in: orgIdsWithGlobalAccess }, status: "ACTIVE" }, orderBy: { createdAt: "asc" } })
    : [];
  return memberships
    .filter((membership) => membership.organization.status === "ACTIVE")
    .map((membership) => ({
      organization: membership.organization,
      role: membership.role,
      allBusinesses: membership.allBusinesses,
      businesses: membership.allBusinesses
        ? globalBusinesses.filter((business) => business.organizationId === membership.organizationId)
        : membership.businesses.map((grant) => grant.business),
    }));
}
