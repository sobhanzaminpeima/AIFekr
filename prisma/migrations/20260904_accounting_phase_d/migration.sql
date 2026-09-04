-- Phase D: payroll, scheduled reports, external BI export.

CREATE TABLE "AccountingEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "AccountingEmployee_workspaceUserId_idx" ON "AccountingEmployee"("workspaceUserId");
CREATE INDEX "AccountingEmployee_userId_idx" ON "AccountingEmployee"("userId");

CREATE TABLE "AccountingPayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "period" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "paidBy" TEXT,
    "paidAt" DATETIME
);
CREATE UNIQUE INDEX "AccountingPayrollRun_workspaceUserId_period_key" ON "AccountingPayrollRun"("workspaceUserId", "period");
CREATE INDEX "AccountingPayrollRun_workspaceUserId_idx" ON "AccountingPayrollRun"("workspaceUserId");

CREATE TABLE "AccountingPayslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL,
    "commissionTotal" REAL NOT NULL DEFAULT 0,
    "bonus" REAL NOT NULL DEFAULT 0,
    "deductions" REAL NOT NULL DEFAULT 0,
    "netPay" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingPayslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "AccountingPayrollRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountingPayslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AccountingEmployee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountingPayslip_payrollRunId_employeeId_key" ON "AccountingPayslip"("payrollRunId", "employeeId");
CREATE INDEX "AccountingPayslip_payrollRunId_idx" ON "AccountingPayslip"("payrollRunId");
CREATE INDEX "AccountingPayslip_employeeId_idx" ON "AccountingPayslip"("employeeId");

CREATE TABLE "AccountingScheduledReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'fa',
    "status" TEXT NOT NULL DEFAULT 'pending_first_approval',
    "firstRunPreview" TEXT,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "AccountingScheduledReport_workspaceUserId_idx" ON "AccountingScheduledReport"("workspaceUserId");

CREATE TABLE "AccountingApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME
);
CREATE UNIQUE INDEX "AccountingApiToken_tokenHash_key" ON "AccountingApiToken"("tokenHash");
CREATE INDEX "AccountingApiToken_workspaceUserId_idx" ON "AccountingApiToken"("workspaceUserId");
