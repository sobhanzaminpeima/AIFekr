export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { moveDealToStage } from "@/lib/repositories/crmRepository";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { stageId } = await req.json();
  if (!stageId) return NextResponse.json({ error: "شناسه مرحله الزامی است" }, { status: 400 });

  const deal = await moveDealToStage(user.id, params.id, stageId);
  if (!deal) return NextResponse.json({ error: "معامله یا مرحله یافت نشد" }, { status: 404 });

  return NextResponse.json({ deal });
}
