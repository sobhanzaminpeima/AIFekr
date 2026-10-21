import { prisma } from "@/lib/db/prisma";
import { canManageOrganization } from "@/lib/organization/context";

export type DeleteBusinessResult =
  | { ok: true; deletedBusinessId: string; newActiveBusinessId: string | null }
  | { ok: false; reason: "not_found" | "forbidden" | "last_business" };

/**
 * Permanently deletes a business and every row scoped to it across the
 * platform (CRM, accounting, voice, lead-gen, SEO, social/Instagram, chat
 * history) -- not just the BusinessWorkspace row itself.
 *
 * businessId was added to ~48 tables additively as a plain, unindexed-by-FK
 * scalar column (see the multi-business isolation work this session), so
 * deleting the parent BusinessWorkspace row does NOT cascade to them the way
 * it would for a real foreign key. Each one is swept explicitly here, in an
 * order that respects the FK relations that DO exist between them (a table
 * with a required, non-cascading reference to another must be deleted first)
 * so no step trips a foreign-key constraint. A handful of tables (SeoAudit,
 * SeoRankSnapshot, SeoContentPlan under SeoSite; VoiceAppointment/CallLog/
 * KnowledgeBase under VoiceAgent) already cascade for real and are included
 * anyway as defence-in-depth, not because it is required.
 *
 * Deliberately refuses to delete an organization's last remaining business
 * (there is always meant to be one to switch back to), and reassigns any
 * user whose active business was this one to another business in the same
 * organization before removing it, since User.activeBusinessId has no
 * ON DELETE rule of its own.
 */
export async function deleteBusinessCompletely(businessId: string, actorId: string): Promise<DeleteBusinessResult> {
  const business = await prisma.businessWorkspace.findUnique({ where: { id: businessId }, select: { id: true, organizationId: true } });
  if (!business) return { ok: false, reason: "not_found" };

  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: business.organizationId, userId: actorId } } });
  if (!membership || membership.status !== "ACTIVE") return { ok: false, reason: "forbidden" };
  const allowed = canManageOrganization({ organizationId: business.organizationId, businessId, memberId: membership.id, role: membership.role as never, permissions: new Set(), allBusinesses: membership.allBusinesses });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const siblings = await prisma.businessWorkspace.findMany({ where: { organizationId: business.organizationId, status: "ACTIVE", id: { not: businessId } }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (siblings.length === 0) return { ok: false, reason: "last_business" };
  const fallbackBusinessId = siblings[0].id;

  await prisma.$transaction(async (tx) => {
    // Users whose active business is the one being deleted must be moved off it
    // FIRST -- User.activeBusinessId -> BusinessWorkspace has no ON DELETE rule,
    // so deleting the row while anyone still points at it would fail outright.
    await tx.user.updateMany({ where: { activeBusinessId: businessId }, data: { activeBusinessId: fallbackBusinessId } });

    const ids = async (model: { findMany: (args: { where: Record<string, unknown>; select: { id: true } }) => Promise<{ id: string }[]> }, where: Record<string, unknown>) =>
      (await model.findMany({ where, select: { id: true } })).map((r) => r.id);

    // ── Chat history ──
    const conversationIds = await ids(tx.conversation, { businessId });
    await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await tx.orchestratorAction.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await tx.conversation.deleteMany({ where: { businessId } });

    // ── Accounting ──
    const journalEntryIds = await ids(tx.accountingJournalEntry, { businessId });
    await tx.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: journalEntryIds } } });
    await tx.accountingJournalEntry.deleteMany({ where: { businessId } });

    const payrollRunIds = await ids(tx.accountingPayrollRun, { businessId });
    await tx.accountingPayslip.deleteMany({ where: { payrollRunId: { in: payrollRunIds } } });
    await tx.accountingPayrollRun.deleteMany({ where: { businessId } });

    const commissionRecordIds = await ids(tx.accountingCommissionRecord, { businessId });
    await tx.accountingCommissionSplit.deleteMany({ where: { commissionRecordId: { in: commissionRecordIds } } });
    await tx.accountingCommissionRecord.deleteMany({ where: { businessId } });

    const ownerStatementIds = await ids(tx.accountingOwnerStatement, { businessId });
    await tx.accountingOwnerStatementEntry.deleteMany({ where: { statementId: { in: ownerStatementIds } } });
    await tx.accountingOwnerStatement.deleteMany({ where: { businessId } });

    await tx.accountingBankTransaction.deleteMany({ where: { businessId } });
    await tx.accountingBankAccount.deleteMany({ where: { businessId } });
    await tx.accountingExpense.deleteMany({ where: { businessId } });
    await tx.accountingEmployee.deleteMany({ where: { businessId } });
    await tx.accountingAiProposal.deleteMany({ where: { businessId } });
    await tx.accountingApiToken.deleteMany({ where: { businessId } });
    await tx.accountingFiscalPeriod.deleteMany({ where: { businessId } });
    await tx.accountingManagementFeeRule.deleteMany({ where: { businessId } });
    await tx.accountingScheduledReport.deleteMany({ where: { businessId } });
    await tx.accountingTaxRate.deleteMany({ where: { businessId } });
    await tx.accountingVendor.deleteMany({ where: { businessId } });
    await tx.accountingAccount.deleteMany({ where: { businessId } });

    // ── CRM ── (children before the parents they reference)
    const dealIds = await ids(tx.crmDeal, { businessId });
    await tx.crmDealProduct.deleteMany({ where: { dealId: { in: dealIds } } });

    const invoiceIds = await ids(tx.crmInvoice, { businessId });
    await tx.crmInvoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.crmInvoiceRevision.deleteMany({ where: { invoiceId: { in: invoiceIds } } });

    const contractIds = await ids(tx.crmContract, { businessId });
    await tx.crmContractRevision.deleteMany({ where: { contractId: { in: contractIds } } });

    const formIds = await ids(tx.leadForm, { businessId });
    await tx.leadFormSubmission.deleteMany({ where: { formId: { in: formIds } } });

    const pipelineIds = await ids(tx.crmPipeline, { businessId });
    await tx.crmStage.deleteMany({ where: { pipelineId: { in: pipelineIds } } });

    await tx.crmDeal.deleteMany({ where: { businessId } });
    await tx.crmInvoice.deleteMany({ where: { businessId } });
    await tx.crmContract.deleteMany({ where: { businessId } });
    await tx.crmPipeline.deleteMany({ where: { businessId } });
    await tx.leadForm.deleteMany({ where: { businessId } });
    await tx.leadSource.deleteMany({ where: { businessId } });

    await tx.crmActivity.deleteMany({ where: { businessId } });
    await tx.crmNote.deleteMany({ where: { businessId } });
    await tx.crmTask.deleteMany({ where: { businessId } });
    await tx.crmDocument.deleteMany({ where: { businessId } });
    await tx.crmInsight.deleteMany({ where: { businessId } });
    await tx.crmAnalysisRun.deleteMany({ where: { businessId } });
    await tx.crmAutomationRule.deleteMany({ where: { businessId } });
    await tx.crmProduct.deleteMany({ where: { businessId } });
    await tx.crmProject.deleteMany({ where: { businessId } });
    await tx.crmContractTemplate.deleteMany({ where: { businessId } });
    // Contact last: everything above that required it (deals, invoices) is already gone;
    // what is left (bookings, viewings, voice calls) points at it with ON DELETE SET NULL.
    await tx.crmContact.deleteMany({ where: { businessId } });

    // ── Real-estate bookings/viewings tied to this business (the Property listing itself
    // is not yet business-scoped -- see the isolation gap noted in the deploy summary --
    // so it is left alone rather than deleted out from under another of the user's businesses). ──
    await tx.propertyBooking.deleteMany({ where: { businessId } });
    await tx.propertyInterest.deleteMany({ where: { businessId } });
    await tx.propertyViewing.deleteMany({ where: { businessId } });

    // ── Voice agent ──
    await tx.voiceAppointment.deleteMany({ where: { businessId } });
    await tx.voiceCallLog.deleteMany({ where: { businessId } });
    await tx.voiceKnowledgeBase.deleteMany({ where: { businessId } });
    await tx.voiceAgent.deleteMany({ where: { businessId } });

    // ── Social / Instagram ──
    await tx.scheduledPost.deleteMany({ where: { businessId } });
    await tx.instagramConnection.deleteMany({ where: { businessId } });

    // ── SEO Monitor (blog-automation runs first: ContentPipelineRun has no cascade of its
    // own from SeoContentPlan, so it would otherwise survive with a dangling planId). ──
    const siteIds = await ids(tx.seoSite, { businessId });
    const planIds = siteIds.length ? (await tx.seoContentPlan.findMany({ where: { siteId: { in: siteIds } }, select: { id: true } })).map((p) => p.id) : [];
    if (planIds.length) {
      const runIds = await ids(tx.contentPipelineRun, { planId: { in: planIds } });
      await tx.contentPipelineStep.deleteMany({ where: { runId: { in: runIds } } });
      await tx.contentPost.deleteMany({ where: { runId: { in: runIds } } });
      await tx.contentPipelineRun.deleteMany({ where: { planId: { in: planIds } } });
    }
    await tx.seoRankSnapshot.deleteMany({ where: { siteId: { in: siteIds } } });
    await tx.seoAudit.deleteMany({ where: { siteId: { in: siteIds } } });
    await tx.seoContentPlan.deleteMany({ where: { siteId: { in: siteIds } } });
    await tx.seoSite.deleteMany({ where: { businessId } });

    // ── Misc business-scoped rows with no children of their own ──
    await tx.accountingBudget.deleteMany({ where: { businessId } });

    // Historical audit/ledger rows are kept (their own relation is ON DELETE SET NULL) --
    // deleting a business should not erase the organization's own audit trail of having
    // had one. BusinessMember rows cascade for real when the row below is removed.
    await tx.businessWorkspace.delete({ where: { id: businessId } });
  });

  return { ok: true, deletedBusinessId: businessId, newActiveBusinessId: fallbackBusinessId };
}
