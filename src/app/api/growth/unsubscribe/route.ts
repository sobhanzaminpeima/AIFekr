import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { setMarketingConsent } from "@/lib/growth/signup";
import { verifyUnsubscribeToken } from "@/lib/growth/request";

const page = (title: string, body: string) => new NextResponse(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,Tahoma,sans-serif;background:#17191d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px"><main style="max-width:440px;background:#292d33;border:1px solid #363b42;border-radius:18px;padding:28px;text-align:center"><h1 style="font-size:20px;color:#ff6b00">${title}</h1><p style="line-height:1.9">${body}</p><a href="/" style="color:#ff6b00">AIFekr</a></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

/** One-click unsubscribe from lifecycle and marketing messages (signed link in every email). */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("u") || "", token = req.nextUrl.searchParams.get("t") || "";
  if (!verifyUnsubscribeToken(userId, token) || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })))
    return page("لینک معتبر نیست · Invalid link", "این لینک لغو اشتراک معتبر نیست. از تنظیمات حساب هم می‌توانید پیام‌ها را خاموش کنید.<br>This unsubscribe link is not valid. You can also turn messages off in your account settings.");
  await setMarketingConsent(userId, false, "unsubscribe_link", { stopAll: true });
  return page("لغو شد · Unsubscribed", "دیگر پیام پیگیری یا تبلیغاتی از AIFekr دریافت نمی‌کنید. پیام‌های ضروری حساب و پرداخت همچنان ارسال می‌شوند.<br>You will no longer receive follow-up or promotional messages. Essential account and payment messages still apply.");
}
