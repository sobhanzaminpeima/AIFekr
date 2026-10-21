-- Additive transition: retain legacy workspaceUserId while accounting reads
-- are migrated to the verified BusinessWorkspace boundary.
ALTER TABLE "AccountingAccount" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingFiscalPeriod" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingJournalEntry" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingVendor" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingExpense" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingCommissionRecord" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingManagementFeeRule" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingOwnerStatement" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingBankAccount" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingBankTransaction" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingTaxRate" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingBudget" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingEmployee" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingPayrollRun" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingScheduledReport" ADD COLUMN "businessId" TEXT;
ALTER TABLE "AccountingApiToken" ADD COLUMN "businessId" TEXT;

CREATE INDEX "AccountingAccount_businessId_idx" ON "AccountingAccount"("businessId");
CREATE INDEX "AccountingFiscalPeriod_businessId_idx" ON "AccountingFiscalPeriod"("businessId");
CREATE INDEX "AccountingJournalEntry_businessId_entryDate_idx" ON "AccountingJournalEntry"("businessId", "entryDate");
CREATE INDEX "AccountingVendor_businessId_idx" ON "AccountingVendor"("businessId");
CREATE INDEX "AccountingExpense_businessId_idx" ON "AccountingExpense"("businessId");
CREATE INDEX "AccountingCommissionRecord_businessId_idx" ON "AccountingCommissionRecord"("businessId");
CREATE INDEX "AccountingManagementFeeRule_businessId_idx" ON "AccountingManagementFeeRule"("businessId");
CREATE INDEX "AccountingOwnerStatement_businessId_idx" ON "AccountingOwnerStatement"("businessId");
CREATE INDEX "AccountingBankAccount_businessId_idx" ON "AccountingBankAccount"("businessId");
CREATE INDEX "AccountingBankTransaction_businessId_idx" ON "AccountingBankTransaction"("businessId");
CREATE INDEX "AccountingTaxRate_businessId_idx" ON "AccountingTaxRate"("businessId");
CREATE INDEX "AccountingBudget_businessId_idx" ON "AccountingBudget"("businessId");
CREATE INDEX "AccountingEmployee_businessId_idx" ON "AccountingEmployee"("businessId");
CREATE INDEX "AccountingPayrollRun_businessId_idx" ON "AccountingPayrollRun"("businessId");
CREATE INDEX "AccountingScheduledReport_businessId_idx" ON "AccountingScheduledReport"("businessId");
CREATE INDEX "AccountingApiToken_businessId_idx" ON "AccountingApiToken"("businessId");

-- One workspace owner can now run several businesses, each with its OWN chart
-- of accounts, monthly budgets and payroll runs. The old workspace-wide unique
-- keys made a second business's default chart of accounts fail with a
-- duplicate-key error, so they become business-aware. (SQLite treats NULLs as
-- distinct in unique indexes, so not-yet-provisioned legacy rows -- businessId
-- NULL -- are guarded by application code exactly as before.)
DROP INDEX IF EXISTS "AccountingAccount_workspaceUserId_code_key";
CREATE UNIQUE INDEX "AccountingAccount_workspaceUserId_businessId_code_key" ON "AccountingAccount"("workspaceUserId", "businessId", "code");

DROP INDEX IF EXISTS "AccountingBudget_workspaceUserId_accountCode_period_key";
CREATE UNIQUE INDEX "AccountingBudget_workspaceUserId_businessId_accountCode_period_key" ON "AccountingBudget"("workspaceUserId", "businessId", "accountCode", "period");

DROP INDEX IF EXISTS "AccountingPayrollRun_workspaceUserId_period_key";
CREATE UNIQUE INDEX "AccountingPayrollRun_workspaceUserId_businessId_period_key" ON "AccountingPayrollRun"("workspaceUserId", "businessId", "period");

-- AI journal-entry / categorisation proposals waiting for human approval must
-- belong to one business, so a pending proposal for business A can never be
-- approved (and posted) from business B.
ALTER TABLE "AccountingAiProposal" ADD COLUMN "businessId" TEXT;
CREATE INDEX "AccountingAiProposal_businessId_idx" ON "AccountingAiProposal"("businessId");
