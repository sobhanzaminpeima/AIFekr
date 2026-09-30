import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugPart(value) {
  return String(value || "workspace").toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "workspace";
}

/**
 * Creates one default Organization + BusinessWorkspace for legacy accounts.
 * It never alters CRM, credits, subscriptions or files: those modules retain
 * their user-scoped behavior until their own business-scoping migrations land.
 * Safe to run repeatedly; users with any organization membership are skipped.
 */
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, country: true, currency: true, language: true, company: { select: { name: true, industry: true } }, organizationMemberships: { select: { id: true }, take: 1 } },
  });
  let created = 0;
  for (const user of users) {
    if (user.organizationMemberships.length) continue;
    const businessName = user.company?.name || user.name || "My Business";
    const organizationName = user.company?.name || user.name || "My Organization";
    const suffix = user.id.slice(-8).toLowerCase();
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName, slug: `${slugPart(organizationName)}-${suffix}`, ownerId: user.id,
          industry: user.company?.industry || null, country: user.country || null,
          currency: user.currency || "USD", language: user.language || "fa",
        },
      });
      const member = await tx.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER", allBusinesses: true } });
      const business = await tx.businessWorkspace.create({
        data: { organizationId: organization.id, name: businessName, slug: `${slugPart(businessName)}-${suffix}`, createdById: user.id, industry: user.company?.industry || null, country: user.country || null, currency: user.currency || "USD" },
      });
      await tx.businessMember.create({ data: { businessId: business.id, organizationMemberId: member.id, userId: user.id, role: "OWNER" } });
      await tx.user.update({ where: { id: user.id }, data: { activeBusinessId: business.id } });
    });
    created++;
  }
  console.log(`Backfilled ${created} legacy organization(s).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
