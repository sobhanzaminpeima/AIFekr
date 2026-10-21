export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const PAGE_KEY = "share/1980s";
const DAILY_CAP_SETTING_KEY = "public_share_1980s_daily_cap";
const DEFAULT_DAILY_CAP = 20;

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [visits, capRow, totalGenerations, todayGenerations] = await Promise.all([
    prisma.publicPageVisit.findMany({ where: { page: PAGE_KEY, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.siteSetting.findUnique({ where: { key: DAILY_CAP_SETTING_KEY } }),
    prisma.generatedImage.count({ where: { kind: "public_share" } }),
    prisma.generatedImage.count({
      where: { kind: "public_share", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const totalVisits = await prisma.publicPageVisit.aggregate({ where: { page: PAGE_KEY }, _sum: { count: true } });

  return NextResponse.json({
    visitsByDay: visits.map((v) => ({ date: v.date.toISOString().slice(0, 10), count: v.count })),
    totalVisits: totalVisits._sum.count || 0,
    dailyCap: capRow ? parseInt(capRow.value, 10) || DEFAULT_DAILY_CAP : DEFAULT_DAILY_CAP,
    totalGenerations,
    todayGenerations,
  });
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dailyCap } = await req.json();
  const n = parseInt(dailyCap, 10);
  if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: "عدد نامعتبر است" }, { status: 400 });

  await prisma.siteSetting.upsert({
    where: { key: DAILY_CAP_SETTING_KEY },
    update: { value: String(n) },
    create: { key: DAILY_CAP_SETTING_KEY, value: String(n) },
  });
  return NextResponse.json({ success: true });
}
