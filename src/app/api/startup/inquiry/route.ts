export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, startupName, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "نام، ایمیل و پیام الزامی است" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
  }

  // optional: attach to logged-in user
  let userId: string | null = null;
  try {
    const user = await requireAuth(req);
    if (user) userId = user.id;
  } catch {}

  const inquiry = await prisma.startupInquiry.create({
    data: {
      userId: userId || undefined,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      startupName: startupName?.trim() || null,
      message: message.trim(),
    },
  });

  return NextResponse.json({ success: true, id: inquiry.id });
}
