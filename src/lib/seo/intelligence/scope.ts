import { prisma } from "@/lib/db/prisma";
import { resolveOrganizationContext } from "@/lib/organization/context";

export class SeoError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export async function seoScope(userId: string, write = false) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { activeBusinessId: true } });
  if (!user.activeBusinessId) return { userId, businessId: null, organizationId: null, where: { userId, businessId: null } };
  const context = await resolveOrganizationContext(userId, user.activeBusinessId);
  if (!context) throw new SeoError("WORKSPACE_ACCESS_DENIED", 403);
  const organization = await prisma.organization.findUnique({ where: { id: context.organizationId }, select: { status: true } });
  if (organization?.status !== "ACTIVE") throw new SeoError("WORKSPACE_ACCESS_DENIED", 403);
  const allowed = context.permissions.has(write ? "seo.manage" : "seo.view");
  if (!allowed) throw new SeoError("WORKSPACE_ACCESS_DENIED", 403);
  return { userId, businessId: context.businessId, organizationId: context.organizationId, where: { businessId: context.businessId } };
}
export async function scopedSeoSite(userId: string, siteId: string, write = false) {
  // Legacy personal sites remain private even after onboarding provisions a
  // business. Never silently move them into a shared organization workspace.
  const personal = await prisma.seoSite.findFirst({ where: { id: siteId, userId, businessId: null, archivedAt: null } });
  if (personal) return { scope: { userId, businessId: null, organizationId: null, where: { userId, businessId: null } }, site: personal };
  const scope = await seoScope(userId, write);
  const site = await prisma.seoSite.findFirst({ where: { id: siteId, ...scope.where, archivedAt: null } });
  if (!site) throw new SeoError("SITE_NOT_FOUND", 404);
  return { scope, site };
}
