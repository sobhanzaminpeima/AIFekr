import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

// Feature name → UsageLog type mapping
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { feature, metadata } = await req.json();
    if (!feature) return NextResponse.json({ ok: false }, { status: 400 });

    await prisma.usageLog.create({
      data: {
        userId: auth.id,
        type: feature,
        credits: 0,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
