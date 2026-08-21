export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/create";

// Hit by a system crontab entry every ~30 minutes, same shared-secret pattern
// as the other cron routes (e.g. crm-automation).
//
// A crypto payment stuck in PENDING (never got a "finished" IPN) for longer
// than STUCK_THRESHOLD_MS needs a human to look at it — NowPayments's IPN
// could be lost, delayed, or the transaction underpaid/never broadcast. We
// never auto-fail it (the money may still be on its way), just flag it once
// so it isn't silently forgotten.
const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const stuck = await prisma.payment.findMany({
    where: { gateway: "usdt_trc20", status: "PENDING", createdAt: { lt: cutoff } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  for (const payment of stuck) {
    console.error(`USDT payment stuck >2h — id=${payment.id} userId=${payment.userId} amount=${payment.amount} createdAt=${payment.createdAt.toISOString()} — needs manual review`);
    await notify(payment.userId, {
      type: "payment_delayed",
      title: "پرداخت شما در حال بررسی است",
      body: "تراکنش USDT شما بیش از حد معمول طول کشیده — تیم پشتیبانی در حال بررسی است.",
      link: "/plans",
    }).catch(() => {});
  }

  return NextResponse.json({ flagged: stuck.length });
}
