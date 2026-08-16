export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hasVoiceAccess, countUserVoiceAgents, FREE_VOICE_AGENT_LIMIT } from "@/lib/voice/workspace";

const DEFAULT_PROMPTS: Record<string, string> = {
  general: "شما یک دستیار صوتی هوشمند یک آژانس املاک هستید. مؤدب، کوتاه و کاربردی صحبت کنید. ابتدا بپرسید تماس‌گیرنده به دنبال خرید، فروش یا اجاره ملک است، سپس بودجه و منطقه مورد نظر را جویا شوید و از ابزار جستجوی ملک برای پیشنهاد گزینه مناسب استفاده کنید. در پایان، وقت بازدید پیشنهاد دهید. برای سوالاتی که به یک ملک خاص مربوط نیست (ساعات کاری، مدارک لازم، شرایط پرداخت و مشابه آن) از ابزار جستجوی دانش‌نامه استفاده کنید.",
  buy: "شما دستیار صوتی بخش خرید ملک یک آژانس املاک هستید. به تماس‌گیرندگانی که قصد خرید ملک دارند کمک کنید: نوع ملک، بودجه، منطقه و تعداد اتاق را بپرسید، با ابزار جستجوی ملک گزینه مناسب پیدا کنید و وقت بازدید رزرو کنید.",
  sell: "شما دستیار صوتی بخش فروش ملک یک آژانس املاک هستید. از مالکانی که می‌خواهند ملک خود را بفروشند، مشخصات ملک و انتظار قیمتی را جویا شوید و اطلاعات را برای پیگیری توسط کارشناس ثبت کنید.",
  rent: "شما دستیار صوتی بخش اجاره ملک یک آژانس املاک هستید. نیاز مستأجر (نوع ملک، بودجه ماهانه، منطقه) را جویا شوید، با ابزار جستجوی ملک گزینه مناسب پیدا کنید و وقت بازدید رزرو کنید.",
};

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const agents = await prisma.voiceAgent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { calls: true, appointments: true } } },
  });
  return NextResponse.json({ agents, voicePlan: user.voicePlan, hasAccess: hasVoiceAccess(user) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const count = await countUserVoiceAgents(user.id);
  if (!hasVoiceAccess(user) && count >= FREE_VOICE_AGENT_LIMIT) {
    return NextResponse.json(
      { error: `پلن رایگان حداکثر ${FREE_VOICE_AGENT_LIMIT} ایجنت صوتی را پشتیبانی می‌کند. برای ایجنت بیشتر، افزونه Voice Agent را فعال کنید.` },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { name, focus, systemPrompt, voiceId } = body;
  if (!name?.trim()) return NextResponse.json({ error: "نام ایجنت الزامی است" }, { status: 400 });

  const resolvedFocus = ["buy", "sell", "rent", "general"].includes(focus) ? focus : "general";

  const agent = await prisma.voiceAgent.create({
    data: {
      userId: user.id,
      name: name.trim(),
      focus: resolvedFocus,
      systemPrompt: systemPrompt?.trim() || DEFAULT_PROMPTS[resolvedFocus],
      voiceId: voiceId || undefined,
    },
  });
  return NextResponse.json({ agent });
}
