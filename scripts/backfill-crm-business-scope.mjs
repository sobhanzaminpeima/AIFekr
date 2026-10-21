import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Only tables which have both a legacy userId and the new businessId are in
// this transition. Child records inherit authorization through their parent.
const scopedModels = [
  "crmContact", "crmPipeline", "crmDeal", "crmDocument", "crmAutomationRule",
  "crmActivity", "crmTask", "crmInsight", "crmAnalysisRun", "crmProduct",
  "crmInvoice", "crmContractTemplate", "crmContract", "crmNote", "crmProject",
  "property", "propertyViewing", "propertyBooking", "propertyInterest",
];

function roleForLegacyCrm(crmRole) {
  if (crmRole === "OWNER") return "OWNER";
  if (crmRole === "MANAGER") return "MANAGER";
  return "MEMBER";
}

async function main() {
  const businesses = await prisma.businessWorkspace.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, createdById: true },
  });
  const ownerBusiness = new Map();
  for (const business of businesses) {
    if (!ownerBusiness.has(business.createdById)) ownerBusiness.set(business.createdById, business);
  }

  // Preserve existing TEAM CRM semantics while converting them to explicit
  // organization/business grants. The member's active business is deliberately
  // left untouched: a person can still retain their own independent business.
  const teamMembers = await prisma.teamMember.findMany({
    where: { crmRole: { not: null } },
    include: { team: { select: { ownerId: true } } },
  });
  for (const member of teamMembers) {
    const business = ownerBusiness.get(member.team.ownerId);
    if (!business || member.userId === member.team.ownerId) continue;
    const organizationMember = await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: business.organizationId, userId: member.userId } },
      update: { status: "ACTIVE" },
      create: { organizationId: business.organizationId, userId: member.userId, role: roleForLegacyCrm(member.crmRole), allBusinesses: false },
    });
    await prisma.businessMember.upsert({
      where: { businessId_userId: { businessId: business.id, userId: member.userId } },
      update: { status: "ACTIVE", role: roleForLegacyCrm(member.crmRole) },
      create: { businessId: business.id, organizationMemberId: organizationMember.id, userId: member.userId, role: roleForLegacyCrm(member.crmRole) },
    });
  }

  let updated = 0;
  for (const [userId, business] of ownerBusiness) {
    for (const modelName of scopedModels) {
      const result = await prisma[modelName].updateMany({ where: { userId, businessId: null }, data: { businessId: business.id } });
      updated += result.count;
    }
  }
  console.log(`Backfilled ${updated} CRM/real-estate record(s) into ${ownerBusiness.size} business workspace(s).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
