import { prisma } from "@/lib/db/prisma";
import {
  reserveLoggedCredits,
  refundLoggedReservation,
} from "@/lib/utils/teamCredits";
import type { ChatIdentity } from "./identity";
import { chatPolicy } from "./policy";
import type { TokenUsage } from "@/lib/ai/providers";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export async function claimTurn(
  identity: ChatIdentity,
  input: { id: string; message: string; conversationId?: string },
) {
  const policy = await chatPolicy();
  if (!policy.enabled) throw Error("CHAT_DISABLED");
  return prisma.$transaction(async (tx) => {
    const day = new Date().toISOString().slice(0, 10),
      quota = await tx.aiChatQuota.upsert({
        where: { id: `global:${day}` },
        create: { id: `global:${day}` },
        update: { used: { increment: 0 } },
      });
    const existing = await tx.aiChatRequest.findUnique({
      where: { id: input.id },
    });
    if (existing) {
      if (
        existing.ownerKey !== identity.key ||
        existing.input !== input.message
      )
        throw Error("REQUEST_CONFLICT");
      return existing;
    }
    const pending = await tx.aiChatRequest.count({
      where: { ownerKey: identity.key, status: "PENDING" },
    });
    if (pending) throw Error("REQUEST_IN_PROGRESS");
    const costs = await tx.aiChatRequest.aggregate({
      where: {
        createdAt: { gte: new Date(day) },
        status: { in: ["PENDING", "SUCCEEDED"] },
      },
      _sum: { costUsd: true },
    });
    if (
      quota.used >= policy.dailyRequests ||
      (costs._sum.costUsd ?? 0) + 0.05 > policy.dailyBudgetUsd
    )
      throw Error("DAILY_BUDGET_REACHED");
    let history: ChatMessage[] = [],
      conversationId = input.conversationId,
      credits = 0,
      reservation: unknown = null;
    if (identity.guest) {
      const guest = await tx.aiChatGuest.findUniqueOrThrow({
        where: { id: identity.guest.id },
      });
      if (guest.mergedUserId || guest.expiresAt <= new Date())
        throw Error("GUEST_EXPIRED");
      if (guest.used >= policy.guestTurns) throw Error("SIGNUP_REQUIRED");
      history = JSON.parse(guest.transcript);
    } else if (identity.user) {
      if (conversationId) {
        const c = await tx.conversation.findFirst({
          where: {
            id: conversationId,
            userId: identity.user.id,
            tool: "general-chat",
          },
          include: {
            messages: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 12,
            },
          },
        });
        if (!c) throw Error("CONVERSATION_NOT_FOUND");
        history = c.messages
          .reverse()
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as ChatMessage["role"],
            content: m.content,
          }));
      } else {
        const c = await tx.conversation.create({
          data: {
            userId: identity.user.id,
            title: input.message.slice(0, 70),
            tool: "general-chat",
          },
        });
        conversationId = c.id;
      }
      const successes = await tx.aiChatRequest.count({
        where: {
          userId: identity.user.id,
          status: "SUCCEEDED",
          createdAt: { gte: new Date(day) },
        },
      });
      if (successes >= policy.registeredFreeDaily) {
        credits = policy.creditsPerTurn;
        reservation = await reserveLoggedCredits(
          tx,
          identity.user.id,
          credits,
          {
            type: "chat",
            requestId: input.id,
            model: policy.modelId,
            metadata: { feature: "independent-chat", status: "RESERVED" },
          },
          "CHAT",
        );
        if (!reservation) throw Error("INSUFFICIENT_CREDITS");
      }
    }
    await tx.aiChatQuota.update({
      where: { id: quota.id },
      data: { used: { increment: 1 } },
    });
    const request = await tx.aiChatRequest.create({
      data: {
        id: input.id,
        ownerKey: identity.key,
        userId: identity.user?.id,
        guestId: identity.guest?.id,
        conversationId: identity.user ? conversationId : undefined,
        input: input.message,
        model: policy.modelId,
        credits,
        reservation: reservation ? JSON.stringify(reservation) : null,
      },
    });
    return {
      ...request,
      history: history
        .slice(-12)
        .map((m) => ({ ...m, content: m.content.slice(-1500) })),
    };
  });
}
export async function settleTurn(
  id: string,
  output: string,
  usage: TokenUsage | null,
) {
  if (!output.trim()) throw Error("EMPTY_RESPONSE");
  return prisma.$transaction(async (tx) => {
    const r = await tx.aiChatRequest.findUniqueOrThrow({ where: { id } });
    const claim = await tx.aiChatRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "SUCCEEDED",
        output,
        usage: JSON.stringify(usage ?? {}),
        costUsd: usage
          ? Math.min(
              0.05,
              Math.max(
                0.000001,
                (usage.promptTokens * 0.293 + usage.completionTokens * 2.253) /
                  1000000,
              ),
            )
          : 0.05,
        completedAt: new Date(),
      },
    });
    if (!claim.count) throw Error("REQUEST_ALREADY_SETTLED");
    if (r.guestId) {
      const g = await tx.aiChatGuest.findUniqueOrThrow({
        where: { id: r.guestId },
      });
      if (g.mergedUserId) throw Error("GUEST_ALREADY_MERGED");
      await tx.aiChatGuest.update({
        where: { id: g.id },
        data: {
          used: { increment: 1 },
          transcript: JSON.stringify([
            ...(JSON.parse(g.transcript) as ChatMessage[]),
            { role: "user", content: r.input },
            { role: "assistant", content: output },
          ]),
        },
      });
    }
    if (r.userId && r.conversationId) {
      await tx.message.create({
        data: {
          conversationId: r.conversationId,
          role: "user",
          content: r.input,
          createdAt: new Date(),
        },
      });
      const assistant = await tx.message.create({
        data: {
          conversationId: r.conversationId,
          role: "assistant",
          content: output,
          createdAt: new Date(Date.now() + 1),
        },
      });
      await tx.aiChatRequest.update({
        where: { id },
        data: { assistantMessageId: assistant.id },
      });
      await tx.conversation.update({
        where: { id: r.conversationId },
        data: { updatedAt: new Date() },
      });
      if (r.reservation) {
        const reservation = JSON.parse(r.reservation);
        await tx.usageLog.update({
          where: { id: reservation.usageLogId },
          data: {
            tokens: usage?.totalTokens,
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            metadata: JSON.stringify({
              feature: "independent-chat",
              status: "SETTLED",
            }),
          },
        });
      }
    }
    return { ...r, output, status: "SUCCEEDED" };
  });
}
export async function failTurn(id: string, code = "PROVIDER_UNAVAILABLE") {
  return prisma.$transaction(async (tx) => {
    const r = await tx.aiChatRequest.findUnique({ where: { id } });
    if (!r) return;
    const claim = await tx.aiChatRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "FAILED",
        errorCode: code,
        costUsd: 0,
        completedAt: new Date(),
      },
    });
    if (!claim.count) return;
    if (r.userId && r.reservation) {
      const reservation = JSON.parse(r.reservation);
      await refundLoggedReservation(
        tx,
        { ...reservation, userId: r.userId, credits: r.credits },
        { feature: "independent-chat", requestId: id },
        "chat",
      );
    }
    const day = r.createdAt.toISOString().slice(0, 10);
    await tx.aiChatQuota.updateMany({
      where: { id: `global:${day}`, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  });
}
export async function expireChatRequests() {
  await prisma.aiChatRequest.updateMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
      status: { in: ["SUCCEEDED", "FAILED"] },
    },
    data: { input: "", output: "" },
  });
  const expiredGuests = await prisma.aiChatGuest.findMany({
    where: { expiresAt: { lt: new Date() } },
    take: 100,
    select: { id: true },
  });
  if (expiredGuests.length)
    await prisma.aiChatRequest.updateMany({
      where: { guestId: { in: expiredGuests.map((g) => g.id) } },
      data: { input: "", output: "" },
    });
  const stale = await prisma.aiChatRequest.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 120000) },
    },
    take: 20,
    select: { id: true },
  });
  for (const r of stale) await failTurn(r.id, "REQUEST_EXPIRED");
  await prisma.aiChatGuest.deleteMany({
    where: { id: { in: expiredGuests.map((g) => g.id) } },
  });
}
export async function mergeGuest(userId: string, guestId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.aiChatQuota.upsert({
      where: { id: `merge:${guestId}` },
      create: { id: `merge:${guestId}` },
      update: { used: { increment: 0 } },
    });
    const g = await tx.aiChatGuest.findUnique({ where: { id: guestId } });
    if (!g || g.expiresAt <= new Date()) return null;
    if (g.mergedUserId) {
      if (g.mergedUserId !== userId) throw Error("GUEST_OWNERSHIP_CONFLICT");
      return g.mergedConversationId;
    }
    if (await tx.aiChatRequest.count({ where: { guestId, status: "PENDING" } }))
      throw Error("REQUEST_IN_PROGRESS");
    const transcript = JSON.parse(g.transcript) as ChatMessage[];
    if (!transcript.length) return null;
    const c = await tx.conversation.create({
      data: {
        userId,
        tool: "general-chat",
        title: transcript[0].content.slice(0, 70),
        messages: {
          create: transcript.map((m, index) => ({
            ...m,
            createdAt: new Date(Date.now() + index),
          })),
        },
      },
    });
    await tx.aiChatGuest.update({
      where: { id: guestId },
      data: {
        mergedUserId: userId,
        mergedConversationId: c.id,
        transcript: "[]",
      },
    });
    return c.id;
  });
}
