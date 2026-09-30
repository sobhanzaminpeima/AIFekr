import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const models = ["accountingAccount", "accountingFiscalPeriod", "accountingJournalEntry", "accountingVendor", "accountingExpense", "accountingCommissionRecord", "accountingManagementFeeRule", "accountingOwnerStatement", "accountingBankAccount", "accountingBankTransaction", "accountingTaxRate", "accountingBudget", "accountingEmployee", "accountingPayrollRun", "accountingScheduledReport", "accountingApiToken"];

async function main() {
  const businesses = await prisma.businessWorkspace.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, createdById: true } });
  const byOwner = new Map();
  for (const business of businesses) if (!byOwner.has(business.createdById)) byOwner.set(business.createdById, business.id);
  let updated = 0;
  for (const [workspaceUserId, businessId] of byOwner) {
    for (const model of models) updated += (await prisma[model].updateMany({ where: { workspaceUserId, businessId: null }, data: { businessId } })).count;
  }
  console.log(`Backfilled ${updated} accounting record(s) across ${byOwner.size} business workspace(s).`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
