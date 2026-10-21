export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const SAMPLE_GAMES = [
  {
    slug: "ai-quiz",
    name: "چالش هوش مصنوعی",
    nameEn: "AI Quiz Challenge",
    description: "دانش خود را درباره هوش مصنوعی بیازمایید",
    type: "quiz",
    durationSec: 120,
    questions: [
      { text: "کدام شرکت مدل GPT-4 را ساخته است؟", options: [{ id: "a", text: "Google" }, { id: "b", text: "OpenAI" }, { id: "c", text: "Meta" }, { id: "d", text: "Apple" }], correctOption: "b", points: 10, order: 1 },
      { text: "LLM مخفف چیست؟", options: [{ id: "a", text: "Large Language Model" }, { id: "b", text: "Low Level Machine" }, { id: "c", text: "Logic Learning Module" }, { id: "d", text: "Linear Logic Matrix" }], correctOption: "a", points: 10, order: 2 },
      { text: "Transformer در یادگیری ماشین چیست؟", options: [{ id: "a", text: "نوعی سخت‌افزار" }, { id: "b", text: "معماری شبکه عصبی" }, { id: "c", text: "زبان برنامه‌نویسی" }, { id: "d", text: "پایگاه داده" }], correctOption: "b", points: 15, order: 3 },
      { text: "Prompt Engineering یعنی چه؟", options: [{ id: "a", text: "ساخت سخت‌افزار" }, { id: "b", text: "بهینه‌سازی دستورات برای AI" }, { id: "c", text: "برنامه‌نویسی پایتون" }, { id: "d", text: "مدیریت پایگاه داده" }], correctOption: "b", points: 10, order: 4 },
      { text: "کدام گزینه یک مدل زبانی متن‌باز است؟", options: [{ id: "a", text: "GPT-4" }, { id: "b", text: "Claude" }, { id: "c", text: "Llama" }, { id: "d", text: "Gemini" }], correctOption: "c", points: 15, order: 5 },
    ],
  },
  {
    slug: "business-challenge",
    name: "چالش کسب‌وکار",
    nameEn: "Business Decision Challenge",
    description: "تصمیم‌گیری‌های تجاری خود را بیازمایید",
    type: "business",
    durationSec: 180,
    questions: [
      { text: "اولین گام در راه‌اندازی یک استارتاپ چیست؟", options: [{ id: "a", text: "جذب سرمایه" }, { id: "b", text: "شناخت مشکل بازار" }, { id: "c", text: "استخدام تیم" }, { id: "d", text: "ثبت شرکت" }], correctOption: "b", points: 10, order: 1 },
      { text: "KPI مخفف چیست؟", options: [{ id: "a", text: "Key Performance Indicator" }, { id: "b", text: "Knowledge Process Integration" }, { id: "c", text: "Key Product Innovation" }, { id: "d", text: "Knowledge Performance Index" }], correctOption: "a", points: 10, order: 2 },
      { text: "کدام استراتژی قیمت‌گذاری برای استارتاپ‌های نوپا مناسب‌تر است؟", options: [{ id: "a", text: "قیمت‌گذاری بر اساس رقبا" }, { id: "b", text: "قیمت‌گذاری بر اساس ارزش" }, { id: "c", text: "قیمت‌گذاری رایگان" }, { id: "d", text: "قیمت‌گذاری بالا" }], correctOption: "b", points: 15, order: 3 },
    ],
  },
];

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  for (const g of SAMPLE_GAMES) {
    const { questions, ...gameData } = g;
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: { ...gameData, isFeatured: true },
      create: { ...gameData, isFeatured: true },
    });

    for (const q of questions) {
      await prisma.gameQuestion.upsert({
        where: { id: `${game.id}_q${q.order}` },
        update: { ...q, gameId: game.id, options: JSON.stringify(q.options) },
        create: { id: `${game.id}_q${q.order}`, ...q, gameId: game.id, options: JSON.stringify(q.options) },
      });
    }
  }

  return NextResponse.json({ ok: true, seeded: SAMPLE_GAMES.length });
}
