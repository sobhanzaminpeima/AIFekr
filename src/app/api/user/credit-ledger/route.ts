export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const PAGE = 50;

/**
 * The signed-in user's own credit ledger: every purchase, grant, spend and
 * refund with the exact amount, the balance right after it and a receipt id,
 * so any balance change can be reconciled to one line. Newest first; pass
 * `before` (an entry id) for the next page. Never another user's rows.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const before = req.nextUrl.searchParams.get("before");
  const cursor = before ? await prisma.creditLedgerEntry.findFirst({ where: { id: before, userId: user.id }, select: { createdAt: true, id: true } }) : null;

  const rows = await prisma.creditLedgerEntry.findMany({
    where: { userId: user.id, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: { id: true, type: true, delta: true, balanceAfter: true, module: true, teamId: true, createdAt: true },
  });

  const entries = rows.slice(0, PAGE).map(({ teamId, ...e }) => ({ ...e, wallet: teamId ? "team" : "personal" }));
  return NextResponse.json({ entries, next: rows.length > PAGE ? entries[entries.length - 1].id : null });
}
