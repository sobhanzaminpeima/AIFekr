import { prisma } from "@/lib/db/prisma";
import type { VoiceAgent, Prisma } from "@prisma/client";

export function callCredits(seconds: number, rate: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(rate) || rate <= 0) throw new Error("INVALID_VOICE_USAGE");
  return Math.ceil(seconds / 60 * rate);
}

/** Reserve on the exact wallet used by this call; concurrency cannot overdraw it. */
export async function reserveVoiceCall(agent: VoiceAgent, callId: string | null, rate: number, seconds: number, direction = "inbound", contactId?: string, callerPhone?: string) {
  return prisma.$transaction(async tx => {
    if (callId) {
      const existing = await tx.voiceCallLog.findUnique({ where: { vapiCallId: callId } });
      if (existing) {
        if (existing.agentId !== agent.id || existing.billingStatus !== "pending") throw new Error("CALL_NOT_AVAILABLE");
        return existing;
      }
    }
    if(direction==="outbound"&&contactId) {
      const ongoing=await tx.voiceCallLog.findFirst({where:{userId:agent.userId,contactId,billingStatus:"pending",createdAt:{gt:new Date(Date.now()-(seconds+60)*1000)}}});
      if(ongoing) throw new Error("CALL_ALREADY_PENDING");
    }
    const membership = await tx.teamMember.findUnique({ where: { userId: agent.userId } });
    const amount = callCredits(seconds, rate);
    const debited = membership
      ? await tx.team.updateMany({ where: { id: membership.teamId, credits: { gte: amount } }, data: { credits: { decrement: amount } } })
      : await tx.user.updateMany({ where: { id: agent.userId, credits: { gte: amount } }, data: { credits: { decrement: amount } } });
    if (!debited.count) throw new Error("INSUFFICIENT_VOICE_CREDITS");
    return tx.voiceCallLog.create({ data: { agentId: agent.id, userId: agent.userId, businessId: agent.businessId, vapiCallId: callId, reservedCredits: amount, creditsPerMinute: rate, creditTeamId: membership?.teamId, direction, contactId, callerPhone } });
  });
}

export async function settleVoiceCall(id: string, seconds: number, data: Prisma.VoiceCallLogUncheckedUpdateInput = {}) {
  return prisma.$transaction(async tx => {
    const call = await tx.voiceCallLog.findUniqueOrThrow({ where: { id } });
    if (call.billingStatus === "settled") return { fresh: false, call };
    const charged = callCredits(seconds, call.creditsPerMinute);
    const additional=Math.max(0,charged-call.reservedCredits);
    if(additional){
      const paid=call.creditTeamId
        ?await tx.team.updateMany({where:{id:call.creditTeamId,credits:{gte:additional}},data:{credits:{decrement:additional}}})
        :await tx.user.updateMany({where:{id:call.userId,credits:{gte:additional}},data:{credits:{decrement:additional}}});
      if(!paid.count)throw new Error("INSUFFICIENT_SETTLEMENT_CREDITS");
    }
    const claim = await tx.voiceCallLog.updateMany({ where: { id, billingStatus: "pending" }, data: { billingStatus: "settled", creditsCharged: charged } });
    if (!claim.count) return { fresh: false, call };
    const refund = Math.max(0,call.reservedCredits - charged);
    if (refund) {
      if (call.creditTeamId) await tx.team.update({ where: { id: call.creditTeamId }, data: { credits: { increment: refund } } });
      else await tx.user.update({ where: { id: call.userId }, data: { credits: { increment: refund } } });
    }
    if(seconds>0){
      if(call.creditTeamId){const t=await tx.team.findUniqueOrThrow({where:{id:call.creditTeamId}});await tx.team.update({where:{id:t.id},data:{voiceMinutes:Math.max(0,t.voiceMinutes-seconds/60)}});}
      else {const u=await tx.user.findUniqueOrThrow({where:{id:call.userId}});await tx.user.update({where:{id:u.id},data:{voiceMinutes:Math.max(0,u.voiceMinutes-seconds/60)}});}
    }
    if (charged) await tx.usageLog.create({ data: { userId: call.userId, type: "voice", provider: "vapi", credits: charged, voiceSeconds: seconds, actualCostUsd: typeof data.cost === "number" ? data.cost : undefined, metadata: JSON.stringify({ callId: call.vapiCallId, callLogId: id, creditTeamId: call.creditTeamId, creditsPerMinute: call.creditsPerMinute }) } });
    const updated = await tx.voiceCallLog.update({ where: { id }, data: { ...data, reservedCredits:Math.max(call.reservedCredits,charged), durationSec: Math.ceil(seconds), endedAt: new Date() } });
    return { fresh: true, call: updated };
  });
}
