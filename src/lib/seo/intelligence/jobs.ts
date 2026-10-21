import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { reserveLoggedCredits, refundLoggedReservation } from "@/lib/utils/teamCredits";
import { featureAccessExpired, teamFeatureExpiry } from "@/lib/subscriptions/access";
import { getSeoProviderConfig, quoteSeoAction } from "./config";
import { scopedSeoSite, SeoError } from "./scope";
import { runProviderResearch, seoRequestSchema, SeoProviderError, type SeoResearchInput } from "./provider";
import { validateSeoMarket } from "./markets";

export const seoInputHash = (input: SeoResearchInput) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
export async function queueSeoResearch(userId: string, input: SeoResearchInput, idempotencyKey: string, confirmedCredits: number) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new SeoError("INVALID_IDEMPOTENCY_KEY");
  const { scope, site } = await scopedSeoSite(userId, input.siteId, true);
  const inputHash = seoInputHash(input);
  const existing = await prisma.seoResearchJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
  if (existing) { if (existing.inputHash !== inputHash || existing.businessId !== scope.businessId) throw new SeoError("IDEMPOTENCY_CONFLICT", 409); return existing; }
  if (!site.verifiedAt) throw new SeoError("SITE_VERIFICATION_REQUIRED", 403);
  const config = await getSeoProviderConfig();
  const quote = quoteSeoAction(config, input.action, input.rows);
  if (quote.credits !== confirmedCredits) throw new SeoError("QUOTE_CHANGED", 409);
  await validateSeoMarket(input);
  return prisma.$transaction(async tx => {
    const old = await tx.seoResearchJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (old) { if (old.inputHash !== inputHash) throw new SeoError("IDEMPOTENCY_CONFLICT", 409); return old; }
    const membership = await tx.teamMember.findUnique({ where: { userId } });
    const walletScope = membership ? { payerTeamId: membership.teamId } : { userId, payerTeamId: null };
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const tenant = scope.organizationId ? { organizationId: scope.organizationId } : { userId };
    if (await tx.seoResearchJob.count({ where: { ...tenant, createdAt: { gte: since } } }) >= config.dailyJobs) throw new SeoError("DAILY_ATTEMPT_LIMIT", 429);
    const spend = await tx.seoResearchJob.aggregate({ where: { ...walletScope, createdAt: { gte: since }, refundedAt: null }, _sum: { credits: true } });
    if ((spend._sum.credits || 0) + quote.credits > config.dailyCredits) throw new SeoError("DAILY_BUDGET_EXCEEDED", 429);
    const tenantSpend = await tx.seoResearchJob.aggregate({ where: { ...tenant, createdAt: { gte: since }, refundedAt: null }, _sum: { credits: true } });
    if ((tenantSpend._sum.credits || 0) + quote.credits > config.dailyCredits) throw new SeoError("TENANT_BUDGET_EXCEEDED", 429);
    if (await tx.seoResearchJob.count({ where: { ...walletScope, status: { in: ["QUEUED", "RUNNING"] } } }) >= config.maxConcurrent) throw new SeoError("QUEUE_LIMIT", 429);
    const id = randomUUID();
    const reservation = await reserveLoggedCredits(tx, userId, quote.credits, { type: "seo_research", requestId: id, metadata: { action: `SEO_${input.action.toUpperCase()}`, status: "RESERVED", siteId: site.id, businessId: scope.businessId, organizationId: scope.organizationId, estimatedCostUsd: quote.providerEstimateUsd, generationJobId: id } });
    if (!reservation) throw new SeoError("INSUFFICIENT_CREDITS", 402);
    await tx.usageLog.update({ where: { id: reservation.usageLogId }, data: { provider: "dataforseo", estimatedCostUsd: quote.providerEstimateUsd } });
    return tx.seoResearchJob.create({ data: { id, siteId: site.id, userId, businessId: scope.businessId, organizationId: scope.organizationId, idempotencyKey, inputHash, input: JSON.stringify(input), action: input.action, credits: quote.credits, estimatedCostUsd: quote.providerEstimateUsd, ...reservation, expiresAt: new Date(Date.now() + 86400000) } });
  });
}

export async function failSeoJob(id: string, code: string, actualCostUsd: number | null = null) {
  return prisma.$transaction(async tx => {
    const job = await tx.seoResearchJob.findUniqueOrThrow({ where: { id } });
    const now = new Date();
    const claim = await tx.seoResearchJob.updateMany({ where: { id, status: { in: ["QUEUED", "RUNNING"] }, refundedAt: null }, data: { status: "FAILED", errorCode: code, refundedAt: now, completedAt: now, actualCostUsd } });
    if (!claim.count) return false;
    const metadata = { action: `SEO_${job.action.toUpperCase()}`, jobId: id, siteId: job.siteId, businessId: job.businessId, organizationId: job.organizationId, errorCode: code, actualCostUsd, providerExpenseState: actualCostUsd === null ? "UNKNOWN" : "REPORTED", payerTeamId: job.payerTeamId };
    await refundLoggedReservation(tx, job, metadata, "seo_research");
    await tx.usageLog.update({ where: { id: job.usageLogId }, data: { actualCostUsd } });
    return true;
  });
}
export async function reconcileSeoJobs() {
  const stale = await prisma.seoResearchJob.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, expiresAt: { lte: new Date() } }, select: { id: true }, take: 50 });
  for (const job of stale) await failSeoJob(job.id, "JOB_EXPIRED");
  return stale.length;
}
export async function processSeoQueue() {
  await reconcileSeoJobs();
  const job = await prisma.seoResearchJob.findFirst({ where: { status: "QUEUED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } });
  if (!job) return null;
  const claim = await prisma.seoResearchJob.updateMany({ where: { id: job.id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date(), expiresAt: new Date(Date.now() + (job.action === "aiVisibility" ? 180000 : 120000)) } });
  if (!claim.count) return null;
  let actualCostUsd: number | null = null;
  try {
    const user = await prisma.user.findUnique({ where: { id: job.userId }, select: { isBlocked: true, plan: true, planExpiry: true, trialEndsAt: true } });
    const membership = await prisma.teamMember.findUnique({ where: { userId: job.userId }, include: { team: { include: { owner: { select: { planExpiry: true } } } } } });
    if (!user || user.isBlocked || featureAccessExpired(user, teamFeatureExpiry(membership?.team))) throw new SeoError("ACCOUNT_ACCESS_DENIED", 403);
    const { site, scope } = await scopedSeoSite(job.userId, job.siteId, true);
    if (!site.verifiedAt || scope.businessId !== job.businessId || scope.organizationId !== job.organizationId) throw new SeoError("WORKSPACE_CHANGED", 403);
    const config = await getSeoProviderConfig();
    const input = seoRequestSchema.parse(JSON.parse(job.input));
    // Disable takes effect even for previously queued work.
    quoteSeoAction(config, input.action, input.rows);
    const result = await runProviderResearch(config, input, new URL(site.url).hostname);
    actualCostUsd = result.actualCostUsd;
    await prisma.$transaction(async tx => {
      const now = new Date();
      const won = await tx.seoResearchJob.updateMany({ where: { id: job.id, status: "RUNNING", expiresAt: { gt: now } }, data: { status: "SUCCEEDED", result: JSON.stringify(result.data), actualCostUsd, providerTaskId: result.providerTaskId, completedAt: now } });
      if (!won.count) throw new SeoError("JOB_NO_LONGER_ACTIVE", 409);
      await tx.usageLog.update({ where: { id: job.usageLogId }, data: { actualCostUsd, metadata: JSON.stringify({ action: `SEO_${job.action.toUpperCase()}`, status: "COMMITTED", jobId: job.id, siteId: job.siteId, businessId: job.businessId, organizationId: job.organizationId, payerTeamId: job.payerTeamId, providerTaskId: result.providerTaskId, creditDelta: -job.credits }) } });
    });
  } catch (error) {
    const code = error instanceof SeoProviderError || error instanceof SeoError ? error.code : "RESEARCH_FAILED";
    if (error instanceof SeoProviderError) actualCostUsd = error.actualCostUsd;
    const refunded = await failSeoJob(job.id, code, actualCostUsd);
    // A concurrent timeout reconciler may already have refunded this job.
    // Persist late actual expense without re-charging or restoring results.
    if (!refunded && actualCostUsd !== null) {
      await prisma.seoResearchJob.update({ where: { id: job.id }, data: { actualCostUsd } });
      await prisma.usageLog.update({ where: { id: job.usageLogId }, data: { actualCostUsd } });
    }
  }
  return job.id;
}
