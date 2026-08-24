export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const METHODS = ["iran_sheba", "iran_card", "intl_card", "paypal"] as const;
type Method = (typeof METHODS)[number];

const SHEBA_RE = /^IR\d{24}$/;
const CARD_RE = /^\d{16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateMethodFields(method: Method, body: Record<string, unknown>): string | null {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (method === "iran_sheba") {
    const sheba = str(body.sheba).toUpperCase().replace(/\s/g, "");
    if (!SHEBA_RE.test(sheba)) return "شماره شبا نامعتبر است — باید با IR شروع شود و ۲۴ رقم داشته باشد";
    if (!str(body.cardHolderName)) return "نام صاحب حساب الزامی است";
    return null;
  }
  if (method === "iran_card") {
    const card = str(body.cardNumber).replace(/[\s-]/g, "");
    if (!CARD_RE.test(card)) return "شماره کارت باید ۱۶ رقم باشد";
    if (!str(body.cardHolderName)) return "نام صاحب کارت الزامی است";
    return null;
  }
  if (method === "intl_card") {
    const card = str(body.cardNumber).replace(/[\s-]/g, "");
    if (card.length < 12 || card.length > 19 || !/^\d+$/.test(card)) return "شماره کارت نامعتبر است";
    return null;
  }
  if (method === "paypal") {
    if (!EMAIL_RE.test(str(body.paypalEmail))) return "ایمیل PayPal نامعتبر است";
    return null;
  }
  return "روش برداشت نامعتبر است";
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { amount, method } = body;

  if (!METHODS.includes(method)) return NextResponse.json({ error: "روش برداشت نامعتبر است" }, { status: 400 });
  const fieldError = validateMethodFields(method, body);
  if (fieldError) return NextResponse.json({ error: fieldError }, { status: 400 });

  const requestedAmount = Math.round(Number(amount));
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return NextResponse.json({ error: "مبلغ نامعتبر است" }, { status: 400 });
  }

  // Reserve (debit) immediately so the same balance can't be requested
  // twice concurrently — refunded automatically if an admin rejects it.
  // Interactive transaction (not the array form) both so the ledger entry
  // can reference the payout request's own id instead of being matched up
  // afterward by amount/type (ambiguous for two same-amount requests), and
  // so the balance check happens on a fresh read inside the transaction —
  // checking it beforehand would leave a TOCTOU window where two concurrent
  // requests could both pass the check and jointly overdraw the wallet.
  let insufficientBalance = false;
  const payoutRequest = await prisma.$transaction(async (tx) => {
    const walletUser = await tx.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    if (!walletUser || requestedAmount > walletUser.walletBalance) {
      insufficientBalance = true;
      return null;
    }
    const created = await tx.walletPayoutRequest.create({
      data: {
        userId: user.id,
        amount: requestedAmount,
        method,
        sheba: method === "iran_sheba" ? String(body.sheba).toUpperCase().replace(/\s/g, "") : undefined,
        cardNumber: method === "iran_card" || method === "intl_card" ? String(body.cardNumber).replace(/[\s-]/g, "") : undefined,
        cardHolderName: method === "iran_sheba" || method === "iran_card" ? String(body.cardHolderName).trim() : undefined,
        paypalEmail: method === "paypal" ? String(body.paypalEmail).trim() : undefined,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { walletBalance: { decrement: requestedAmount } } });
    await tx.walletTransaction.create({
      data: { userId: user.id, type: "payout_request", amount: -requestedAmount, payoutRequestId: created.id, note: "درخواست برداشت نقدی" },
    });
    return created;
  });

  if (insufficientBalance || !payoutRequest) {
    return NextResponse.json({ error: "مبلغ درخواستی بیشتر از موجودی ولت شماست" }, { status: 400 });
  }

  return NextResponse.json({ payoutRequest });
}
