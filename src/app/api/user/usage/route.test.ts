import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const userId = `usage-report-${crypto.randomUUID()}`;
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: userId }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
import { prisma } from "@/lib/db/prisma";
import { GET } from "./route";
beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, credits: 100 } });
  await prisma.usageLog.createMany({ data: [
    { userId, type: "chat", credits: 4 }, { userId, type: "chat", credits: 1 }, { userId, type: "tool", credits: 2 },
    { userId, type: "chat", credits: 99, createdAt: new Date(Date.now() - 40 * 86400000) },
  ] });
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect(); });
describe("account usage date filtering", () => {
  it("includes recent persisted SQLite timestamps and excludes older usage", async () => {
    const data = await (await GET(new NextRequest("https://aifekr.test/api/user/usage"))).json();
    expect(data.totalCredits).toBe(7);
    expect(data.byType).toContainEqual({ type: "chat", count: 2, totalCredits: 5 });
    expect(data.byType).toContainEqual({ type: "tool", count: 1, totalCredits: 2 });
  });
});
