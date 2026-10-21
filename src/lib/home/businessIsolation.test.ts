import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getHomeSummary } from "./summary";

/**
 * The dashboard "what needs me today?" summary must reflect only the ACTIVE
 * business -- one owner running several businesses must never see business B's
 * leads/contacts while looking at business A.
 */
const P = `homeiso${Date.now().toString(36)}`;
const wsUserId = `${P}ws`;
const bizA = `${P}bizA`;
const bizB = `${P}bizB`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: wsUserId, name: "ws" } });
  await prisma.crmContact.create({ data: { userId: wsUserId, businessId: bizA, name: "Lead A1" } });
  await prisma.crmContact.create({ data: { userId: wsUserId, businessId: bizA, name: "Lead A2" } });
  await prisma.crmContact.create({ data: { userId: wsUserId, businessId: bizB, name: "Lead B1" } });
});

afterAll(async () => {
  await prisma.crmContact.deleteMany({ where: { userId: wsUserId } });
  await prisma.user.deleteMany({ where: { id: wsUserId } });
});

describe("getHomeSummary business isolation", () => {
  it("only counts the active business's own leads", async () => {
    const a = await getHomeSummary(wsUserId, "en", bizA);
    const b = await getHomeSummary(wsUserId, "en", bizB);
    expect(a.stats.newLeadsThisWeek).toBe(2);
    expect(b.stats.newLeadsThisWeek).toBe(1);
  });

  it("with no business (legacy caller) sees everything, same as before this change", async () => {
    const all = await getHomeSummary(wsUserId, "en");
    expect(all.stats.newLeadsThisWeek).toBe(3);
  });
});
