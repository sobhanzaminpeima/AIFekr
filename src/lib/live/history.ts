import { prisma } from "@/lib/db/prisma";
import { LiveError } from "./service";

/**
 * AIFekr Live conversations, saved like chat conversations (Conversation with
 * tool "live") so a call can be read back and continued later: both modes
 * write each spoken line here, and a new turn or call in the same conversation
 * starts from its recent lines. Kept out of the main chat history
 * (lib/chat/history chatHistoryWhere).
 */
export const LIVE_TOOL = "live";
const CONTEXT_MESSAGES = 30, CONTEXT_CHARS = 12000;

/** The caller's live conversation, or a new one; throws when the id is someone else's. */
export async function liveConversation(userId: string, id?: string | null) {
  if (id) {
    const row = await prisma.conversation.findFirst({ where: { id, userId, tool: LIVE_TOOL }, select: { id: true } });
    if (!row) throw new LiveError("CONVERSATION_NOT_FOUND", 404);
    return row.id;
  }
  return (await prisma.conversation.create({ data: { userId, tool: LIVE_TOOL, model: "aifekr-live" }, select: { id: true } })).id;
}

/** Appends one spoken line; the first thing the user says becomes the title. */
export async function saveLine(conversationId: string, role: "user" | "assistant", content: string) {
  const text = content.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!text) return;
  await prisma.message.create({ data: { conversationId, role, content: text } });
  await prisma.conversation.updateMany({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  if (role === "user") await prisma.conversation.updateMany({ where: { id: conversationId, title: null }, data: { title: text.slice(0, 60) } });
}

/** The conversation's latest lines, oldest first, within a size limit (for the model's context). */
export async function recentLines(conversationId: string) {
  const rows = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: CONTEXT_MESSAGES, select: { role: true, content: true } });
  const out: { role: "user" | "assistant"; content: string }[] = [];
  let size = 0;
  for (const r of rows) {
    if (r.role !== "user" && r.role !== "assistant") continue;
    size += r.content.length;
    if (size > CONTEXT_CHARS) break;
    out.unshift({ role: r.role, content: r.content });
  }
  return out;
}

export async function listLiveConversations(userId: string) {
  return prisma.conversation.findMany({ where: { userId, tool: LIVE_TOOL, messages: { some: {} } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, updatedAt: true } });
}

export async function liveConversationLines(userId: string, id: string) {
  const row = await prisma.conversation.findFirst({ where: { id, userId, tool: LIVE_TOOL }, select: { id: true, title: true } });
  if (!row) throw new LiveError("CONVERSATION_NOT_FOUND", 404);
  const messages = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, take: 400, select: { role: true, content: true } });
  return { ...row, messages };
}

export async function deleteLiveConversation(userId: string, id: string) {
  await prisma.conversation.deleteMany({ where: { id, userId, tool: LIVE_TOOL } });
}
