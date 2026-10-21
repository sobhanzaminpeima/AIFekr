import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { chatHistoryWhere } from "./history";

afterAll(() => prisma.$disconnect());
describe("sidebar history query", () => {
  it("includes ordinary NULL-tool chats and tagged tools, excludes support and other users", async () => {
    const id = `history-${crypto.randomUUID()}`;
    const other = `${id}-other`;
    await prisma.user.createMany({ data: [{ id }, { id: other }] });
    try {
      const plain = await prisma.conversation.create({ data: { userId: id, title: "ordinary" } });
      const image = await prisma.conversation.create({ data: { userId: id, title: "image", tool: "image" } });
      await prisma.conversation.createMany({ data: [{ userId: id, tool: "support" }, { userId: other, title: "private" }] });
      const rows = await prisma.conversation.findMany({ where: chatHistoryWhere(id) });
      expect(rows.map(row => row.id).sort()).toEqual([plain.id, image.id].sort());
      const scope = chatHistoryWhere(id, "active-business");
      expect(scope.businessId).toBe("active-business");
      expect(scope.userId).toBe(id);
    } finally {
      await prisma.conversation.deleteMany({ where: { userId: { in: [id, other] } } });
      await prisma.user.deleteMany({ where: { id: { in: [id, other] } } });
    }
  });
});
