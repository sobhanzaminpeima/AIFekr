import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { chatHistoryWhere } from "@/lib/chat/history";
import { liveConversation, listLiveConversations, recentLines, saveLine } from "./history";

const USER = `test-live-history-${Date.now()}`;
afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { userId: USER } });
  await prisma.user.deleteMany({ where: { id: { in: [USER, USER + "-other"] } } });
});

describe("AIFekr Live saved conversations", () => {
  it("saves lines, titles by the first user line, continues from them, and stays out of chat history", async () => {
    await prisma.user.createMany({ data: [{ id: USER, name: "history test" }, { id: USER + "-other", name: "other" }] });
    const id = await liveConversation(USER);
    await saveLine(id, "user", "سلام، اسم من مهراد است");
    await saveLine(id, "assistant", "سلام مهراد! چطوری؟");
    expect(await recentLines(id)).toEqual([{ role: "user", content: "سلام، اسم من مهراد است" }, { role: "assistant", content: "سلام مهراد! چطوری؟" }]);
    expect((await listLiveConversations(USER)).map((c) => c.title)).toEqual(["سلام، اسم من مهراد است"]);
    expect(await liveConversation(USER, id)).toBe(id);
    await expect(liveConversation(USER + "-other", id)).rejects.toThrow("CONVERSATION_NOT_FOUND");
    expect(await prisma.conversation.count({ where: { ...chatHistoryWhere(USER), id } })).toBe(0);
  });
});
