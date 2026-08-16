import { prisma } from "@/lib/db/prisma";

/**
 * Entitlement gate for the Voice Agent add-on — mirrors src/lib/crm/workspace.ts's
 * crmPlan pattern. Unlike CRM there's no team-seat sharing here (an agency account
 * runs its own agents), so this is just a thin plan check, not a workspace resolver.
 */
export function hasVoiceAccess(user: { voicePlan?: string | null; voicePlanExpiry?: Date | null }): boolean {
  if (!user.voicePlan || user.voicePlan === "NONE") return false;
  if (user.voicePlanExpiry && user.voicePlanExpiry.getTime() < Date.now()) return false;
  return true;
}

/** Free-tier cap on number of agents a user can create before purchasing the add-on. */
export const FREE_VOICE_AGENT_LIMIT = 1;

export async function countUserVoiceAgents(userId: string) {
  return prisma.voiceAgent.count({ where: { userId } });
}

/**
 * VoiceProperty.price is BigInt (Toman prices routinely exceed Int32's 2.1B
 * ceiling), but `NextResponse.json`/`JSON.stringify` can't serialize BigInt
 * at all — every route returning a property must run it through this first.
 * Safe as a plain Number: real-estate prices never approach
 * Number.MAX_SAFE_INTEGER (~9 quadrillion).
 */
export function serializeVoiceProperty<T extends { price: bigint }>(p: T): Omit<T, "price"> & { price: number } {
  return { ...p, price: Number(p.price) };
}
