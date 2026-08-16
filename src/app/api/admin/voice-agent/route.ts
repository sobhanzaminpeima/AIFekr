export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { voiceAgents: { some: {} } };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const [users, total, totals] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, phone: true, voicePlan: true, voicePlanExpiry: true,
        _count: { select: { voiceAgents: true, voiceCallLogs: true, voiceAppointments: true } },
      },
    }),
    prisma.user.count({ where }),
    Promise.all([
      prisma.user.count({ where: { voicePlan: "ACTIVE" } }),
      prisma.voiceAgent.count(),
      prisma.voiceAgent.count({ where: { phoneNumber: { not: null } } }),
      prisma.voiceCallLog.count(),
      prisma.voiceAppointment.count(),
    ]),
  ]);

  const [activeSubscribers, totalAgents, agentsWithNumber, totalCalls, totalAppointments] = totals;

  return NextResponse.json({
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: { activeSubscribers, totalAgents, agentsWithNumber, totalCalls, totalAppointments },
  });
}
