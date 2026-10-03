import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { PAYMENT_ACCOUNTS } from "./accounts";
export function validIban(input: string) {
  const value = input.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  const digits = (value.slice(4) + value.slice(0,4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0)-55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}
export async function bankSettings() {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: ["bank_iban","bank_holder","bank_currency","bank_iban_eur","admin_notification_email","admin_email"] } } });
  const map = Object.fromEntries(rows.map(r=>[r.key,r.value]));
  return { iban: map.bank_iban || PAYMENT_ACCOUNTS.TRY, holder: map.bank_holder || PAYMENT_ACCOUNTS.holder, currency: map.bank_currency || "TRY", euroIban: map.bank_iban_eur || PAYMENT_ACCOUNTS.EUR, email: map.admin_notification_email || map.admin_email || "admin@aifekr.com" };
}
// The database is the durable notification queue. Failed delivery never loses a receipt.
export async function notifyReceipt(id: string) {
  const payment = await prisma.payment.findUnique({where:{id}});
  if (!payment?.receiptAt) return;
  if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true" && !payment.telegramSentAt) {
    let telegramError: string | null = null;
    try {
      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) throw new Error("Telegram destination is not configured");
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:`AIFekr: new payment receipt\nOrder: ${id}\n${payment.transferMinor/100} ${payment.transferCurrency}\n${process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com"}/admin/financial`}),signal:AbortSignal.timeout(10000)});
      const result = await response.json(); if(!result.ok) throw new Error("Telegram delivery failed");
    } catch(e) { telegramError=e instanceof Error?e.message:"Telegram delivery failed"; }
    await prisma.payment.update({where:{id},data:{telegramError,...(!telegramError?{telegramSentAt:new Date()}: {})}});
  }
  if (payment.notificationSentAt) return;
  const settings = await bankSettings();
  let error: string | null = null;
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) throw new Error("Email provider is not configured");
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM,to:settings.email,subject:`AIFekr: payment receipt ${id}`,html:`<p>A new bank-transfer receipt requires review.</p><p>Payment: ${id}</p><p>Amount: ${payment.transferMinor/100} ${payment.transferCurrency}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com"}/admin/financial">Review in dashboard</a></p>`});
    if (result.error) throw new Error(result.error.message);
  } catch(e) { error = e instanceof Error ? e.message : "Delivery failed"; }
  await prisma.payment.update({where:{id},data:{notificationAttempts:{increment:1},notificationError:error,...(!error?{notificationSentAt:new Date()}: {})}});
}
