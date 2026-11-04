import type { Prisma } from "@prisma/client";
import { bizScope } from "@/lib/accounting/scope";

export function chatHistoryWhere(userId: string, businessId?: string | null): Prisma.ConversationWhereInput {
  // SQL NOT does not include NULL: ordinary chat has no tool tag. AIFekr Live keeps its own history (lib/live/history).
  return { userId, ...bizScope(businessId), OR: [{ tool: null }, { tool: { notIn: ["support", "live"] } }] };
}

export const CHAT_HISTORY_UPDATED_EVENT = "aifekr:chat-history-updated";
export type ChatHistoryItem = { id: string; title?: string | null; updatedAt: string; projectId?: string | null };
