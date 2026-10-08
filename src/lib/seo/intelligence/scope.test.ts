import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { seoScope, scopedSeoSite } from "./scope";
const suffix = `seo-scope-${Date.now()}`;
const owner = `${suffix}-owner`, viewer = `${suffix}-viewer`;
let orgId = "", businessId = "", forbiddenId = "", siteId = "";
beforeAll(async () => {
  await prisma.user.createMany({ data: [{ id: owner }, { id: viewer }] });
  const org = await prisma.organization.create({ data: { ownerId: owner, name: "SEO isolated scope", slug: suffix } }); orgId = org.id;
  const own = await prisma.organizationMember.create({ data: { organizationId: orgId, userId: owner, role: "OWNER", allBusinesses: true } });
  const view = await prisma.organizationMember.create({ data: { organizationId: orgId, userId: viewer, role: "VIEWER", allBusinesses: false } });
  const business = await prisma.businessWorkspace.create({ data: { organizationId: orgId, name: "Allowed", slug: `${suffix}-a`, createdById: owner } }); businessId = business.id;
  const forbidden = await prisma.businessWorkspace.create({ data: { organizationId: orgId, name: "Forbidden", slug: `${suffix}-b`, createdById: owner } }); forbiddenId = forbidden.id;
  await prisma.businessMember.createMany({ data: [{ businessId, organizationMemberId: own.id, userId: owner, role: "OWNER" }, { businessId, organizationMemberId: view.id, userId: viewer, role: "VIEWER" }] });
  await prisma.user.updateMany({ where: { id: { in: [owner, viewer] } }, data: { activeBusinessId: businessId } });
  siteId = (await prisma.seoSite.create({ data: { userId: owner, businessId, url: "https://example.com/" } })).id;
});
afterAll(async () => {
  await prisma.seoSite.deleteMany({ where: { id: siteId } });
  await prisma.user.updateMany({ where: { id: { in: [owner, viewer] } }, data: { activeBusinessId: null } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, viewer] } } });
});
describe("SEO tenant isolation", () => {
  it("shares business data with an authorized viewer but refuses writes", async () => { expect((await scopedSeoSite(viewer, siteId)).site.id).toBe(siteId); await expect(scopedSeoSite(viewer, siteId, true)).rejects.toThrow("WORKSPACE_ACCESS_DENIED"); });
  it("does not fall back to personal scope when business membership fails", async () => { await prisma.user.update({ where: { id: viewer }, data: { activeBusinessId: forbiddenId } }); await expect(seoScope(viewer)).rejects.toThrow("WORKSPACE_ACCESS_DENIED"); await prisma.user.update({ where: { id: viewer }, data: { activeBusinessId: businessId } }); });
  it("blocks inactive organizations even with valid membership", async () => { await prisma.organization.update({ where: { id: orgId }, data: { status: "SUSPENDED" } }); await expect(seoScope(owner)).rejects.toThrow("WORKSPACE_ACCESS_DENIED"); await prisma.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } }); });
});
