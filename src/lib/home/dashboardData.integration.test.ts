import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { dashboardData } from "./dashboardData";

const userId = `dashboard-qa-${Date.now()}`, other = userId + "-other";
const now = new Date("2026-10-30T12:00:00Z");
const ago = (days: number, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 3600_000);

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, name: "Sara  Mohammadi", commissionPercentOverride: 12 } });
  await prisma.user.create({ data: { id: other } });
  await prisma.generatedImage.create({ data: { userId, prompt: "old image", url: "/a.png", createdAt: ago(5) } });
  await prisma.generatedImage.create({ data: { userId, prompt: "new image", url: "/b.png", createdAt: ago(0, 1) } });
  await prisma.generatedVideo.create({ data: { userId, prompt: "refunded video", url: "/v.mp4", refunded: true, createdAt: ago(0, 2) } });
  await prisma.generatedMusic.create({ data: { userId, prompt: "song", url: "/m.mp3", createdAt: ago(1) } });
  await prisma.generatedImage.create({ data: { userId: other, prompt: "not mine", url: "/x.png", createdAt: ago(0) } });
  await prisma.usageLog.createMany({ data: [
    { userId, type: "chat", credits: 4, createdAt: ago(0, 3) },
    { userId, type: "image", credits: 10, createdAt: ago(6, 23) },
    { userId, type: "chat", credits: 7, createdAt: ago(8) },
    { userId, type: "chat", credits: 99, createdAt: ago(20) },
    { userId: other, type: "chat", credits: 50, createdAt: ago(0) },
  ] });
});
afterAll(async () => {
  await prisma.usageLog.deleteMany({ where: { userId: { in: [userId, other] } } });
  await prisma.generatedImage.deleteMany({ where: { userId: { in: [userId, other] } } });
  await prisma.generatedVideo.deleteMany({ where: { userId } });
  await prisma.generatedMusic.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, other] } } });
});

it("shows only the account's own latest creations, newest first, without refunded jobs", async () => {
  const d = await dashboardData(userId, now);
  expect(d.firstName).toBe("Sara");
  expect(d.recent.map((r) => [r.type, r.prompt])).toEqual([["image", "new image"], ["music", "song"], ["image", "old image"]]);
});
it("counts this week's and last week's credits from the usage ledger", async () => {
  const d = await dashboardData(userId, now);
  expect(d.usage.thisWeek).toBe(14);
  expect(d.usage.lastWeek).toBe(7);
  expect(d.usage.days).toHaveLength(7);
  expect(d.usage.days[6]).toBe(4);
  expect(d.usage.days[0]).toBe(10);
});
it("uses the account's own commission rate", async () => {
  expect((await dashboardData(userId, now)).commissionPercent).toBe(12);
});
