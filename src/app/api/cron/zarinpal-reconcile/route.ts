export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { closeAbandonedGatewayOrder } from "@/lib/payment/adminLifecycle";

// A Zarinpal link lives 15 minutes; an order still PENDING well after that was
// abandoned at the gateway, or its return was lost. Each one is checked with
// Zarinpal first (closeAbandonedGatewayOrder): a payment that did go through
// is settled, anything else is closed as not completed (FAILED). Never marked paid without
// Zarinpal's confirmation. Meant for a crontab entry like the other cron routes.
const AFTER_MS = 30 * 60 * 1000;
const BATCH = 20;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.payment.findMany({
    where: { gateway: "zarinpal", status: "PENDING", authority: { not: null }, createdAt: { lt: new Date(Date.now() - AFTER_MS) } },
    orderBy: { createdAt: "asc" }, take: BATCH, select: { id: true, authority: true },
  });
  const result = { checked: rows.length, settled: 0, closed: 0, unresolved: 0 };
  for (const row of rows) {
    const status = await closeAbandonedGatewayOrder(row.id, row.authority!);
    if (status === "SUCCESS") result.settled++;
    else if (status === "FAILED") result.closed++;
    else result.unresolved++;
  }
  return NextResponse.json(result);
}
