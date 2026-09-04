import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getTrialBalance, getProfitAndLoss } from "./reports";

/**
 * Read-only external-BI export API (spec ۴ "API برای اتصال BI خارجی"). Auth
 * is a separate bearer-token scheme from the app's session JWT — a token is
 * generated once, shown to the user, and only its sha256 hash is stored
 * (same "never store the verifiable secret in plaintext" shape as a password
 * hash, just cheap hashing since this is a revocable API key, not a
 * user credential). There is no write side: a BI tool can only ever read.
 */

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Returns the raw token — shown to the caller exactly once; only the hash is persisted. */
export async function createApiToken(workspaceUserId: string, label: string): Promise<{ id: string; token: string }> {
  const raw = `bi_${randomBytes(24).toString("hex")}`;
  const row = await prisma.accountingApiToken.create({
    data: { workspaceUserId, label, tokenHash: hashToken(raw) },
  });
  return { id: row.id, token: raw };
}

export async function listApiTokens(workspaceUserId: string) {
  return prisma.accountingApiToken.findMany({
    where: { workspaceUserId },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function revokeApiToken(id: string, workspaceUserId: string) {
  const token = await prisma.accountingApiToken.findFirstOrThrow({ where: { id, workspaceUserId } });
  if (token.revokedAt) return token;
  return prisma.accountingApiToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

/** Verifies a bearer token from the BI export endpoint and returns the workspace it grants read access to, or null. */
export async function verifyApiToken(rawToken: string): Promise<string | null> {
  const row = await prisma.accountingApiToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.revokedAt) return null;
  await prisma.accountingApiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return row.workspaceUserId;
}

export interface BiExport {
  from: string;
  to: string;
  trialBalance: Awaited<ReturnType<typeof getTrialBalance>>;
  profitAndLoss: Awaited<ReturnType<typeof getProfitAndLoss>>;
  invoiceCount: number;
  expenseCount: number;
}

/** The actual data bundle handed to an external BI tool — aggregates only, never raw customer PII beyond what invoices/expenses already store. */
export async function getBiExport(workspaceUserId: string, from: Date, to: Date): Promise<BiExport> {
  const [trialBalance, profitAndLoss, invoiceCount, expenseCount] = await Promise.all([
    getTrialBalance(workspaceUserId, to),
    getProfitAndLoss(workspaceUserId, from, to),
    prisma.crmInvoice.count({ where: { userId: workspaceUserId, issueDate: { gte: from, lte: to } } }),
    prisma.accountingExpense.count({ where: { workspaceUserId, expenseDate: { gte: from, lte: to } } }),
  ]);
  return { from: from.toISOString(), to: to.toISOString(), trialBalance, profitAndLoss, invoiceCount, expenseCount };
}
