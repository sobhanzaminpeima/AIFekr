import { prisma } from "@/lib/db/prisma";
import { getCrmTemplate } from "@/lib/crm/industryTemplates";

/**
 * Centralizes the CRM write paths that need more than a plain userId-scoped
 * CRUD — pipeline seeding from an industry template, and moving a deal
 * between stages (which must verify the target stage actually belongs to
 * the deal's own pipeline, not just to the user, or a deal could be dropped
 * into another pipeline's stage by ID guessing).
 */

export function createPipelineFromTemplate(userId: string, industrySlug: string | null, isDefault: boolean) {
  const template = getCrmTemplate(industrySlug);
  return prisma.crmPipeline.create({
    data: {
      userId,
      name: template.pipelineName,
      industrySlug: industrySlug || undefined,
      isDefault,
      stages: {
        create: template.stages.map((s, i) => ({
          name: s.name,
          order: i,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        })),
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

/**
 * Verifies the deal, and the target stage, both belong to this user before
 * moving. Landing on an isWon stage auto-advances the linked contact's
 * lifecycle to "customer" (only moving it forward, never backward — a
 * contact that's already a customer stays one even if a later deal is lost).
 * Landing on an isLost stage accepts an optional reason, since a deal falling
 * through needs to be recorded, not just silently vanish from the board.
 */
export async function moveDealToStage(userId: string, dealId: string, stageId: string, lostReason?: string) {
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId } });
  if (!deal) return null;

  const stage = await prisma.crmStage.findFirst({
    where: { id: stageId, pipelineId: deal.pipelineId },
  });
  if (!stage) return null;

  const updated = await prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      stageId,
      status: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
      wonAt: stage.isWon ? new Date() : null,
      lostReason: stage.isLost ? (lostReason || undefined) : undefined,
    },
  });

  if (stage.isWon) {
    await prisma.crmContact.updateMany({
      where: { id: deal.contactId, status: { in: ["lead", "qualified"] } },
      data: { status: "customer" },
    });
  }

  return updated;
}

export async function countUserContacts(userId: string): Promise<number> {
  return prisma.crmContact.count({ where: { userId } });
}
