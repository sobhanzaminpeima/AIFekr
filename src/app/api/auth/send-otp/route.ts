export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendOTP } from "@/lib/sms/kavenegar";

// شماره‌های تست — همیشه کد 1234
const TEST_PHONES = ["09000000000", "09000000001", "09000000002"];

function generateOtp(phone: string): string {
  if (TEST_PHONES.includes(phone)) return "1234";
  if (process.env.NODE_ENV === "development") return "1234";
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^09[0-9]{9}$/.test(phone)) {
      return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
    }

    // Rate limit: max 5 per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtps = await prisma.otpCode.count({ where: { phone, createdAt: { gte: oneHourAgo } } });
    if (recentOtps >= 5) {
      return NextResponse.json({ error: "تعداد درخواست‌ها بیش از حد مجاز است. یک ساعت دیگر تلاش کنید" }, { status: 429 });
    }

    const code = generateOtp(phone);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpCode.create({ data: { phone, code, expiresAt } });

    const isTest = TEST_PHONES.includes(phone);
    const isDev = process.env.NODE_ENV === "development";

    if (isTest || isDev) {
      console.log(`OTP for ${phone}: ${code}`);
      return NextResponse.json({ success: true, dev_code: code });
    }

    // Send real SMS
    const sent = await sendOTP(phone, code);
    if (!sent) {
      return NextResponse.json({ error: "خطا در ارسال پیامک. لطفاً دوباره تلاش کنید" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
