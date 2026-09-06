export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Public, unauthenticated — powers the /o/[token] page an owner opens from
 * their statement email. Only what a token holder needs to see: the figures
 * for that one statement and its property's name, never any other property,
 * any other statement, or anything about the agency's own workspace.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const statement = await prisma.accountingOwnerStatement.findFirst({
    where: { shareToken: params.token, status: "sent" },
    select: {
      month: true, currency: true, incomeTotal: true, expenseTotal: true,
      netProfit: true, managementFee: true, ownerShare: true, sentAt: true,
      property: { select: { title: true, address: true, city: true } },
      entries: { orderBy: { date: "asc" }, select: { date: true, description: true, category: true, income: true, expense: true } },
    },
  });
  if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 });

  return NextResponse.json({ statement });
}
