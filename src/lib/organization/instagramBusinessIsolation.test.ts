import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { bizScope } from "@/lib/accounting/scope";

/**
 * InstagramConnection moved from one-per-user to one-per-(user,business), so a
 * user running several businesses can connect a different Instagram account to
 * each -- and a query scoped to the wrong business must not see the other's.
 */
const P = `igiso${Date.now().toString(36)}`;
const userId = `${P}u`;
const bizA = `${P}bizA`;
const bizB = `${P}bizB`;

afterAll(async () => {
  await prisma.instagramConnection.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("InstagramConnection per business", () => {
  it("lets one user connect a different account per business, and a query only finds its own", async () => {
    await prisma.user.create({ data: { id: userId, name: "u" } });
    await prisma.instagramConnection.create({ data: { userId, businessId: bizA, igUserId: "ig-a", igUsername: "biz_a", pageId: "page-a", accessToken: "token-a" } });
    await prisma.instagramConnection.create({ data: { userId, businessId: bizB, igUserId: "ig-b", igUsername: "biz_b", pageId: "page-b", accessToken: "token-b" } });

    const a = await prisma.instagramConnection.findFirst({ where: { userId, ...bizScope(bizA) } });
    const b = await prisma.instagramConnection.findFirst({ where: { userId, ...bizScope(bizB) } });
    expect(a?.igUsername).toBe("biz_a");
    expect(b?.igUsername).toBe("biz_b");
  });

  it("without a business (legacy caller) matches any of the user's connections", async () => {
    const any = await prisma.instagramConnection.findFirst({ where: { userId, ...bizScope(undefined) } });
    expect(any).not.toBeNull();
  });
});
