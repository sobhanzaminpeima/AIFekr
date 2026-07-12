export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { buildBusinessSnapshot } from "@/lib/agents/businessSnapshot";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const snapshot = await buildBusinessSnapshot(user.id);
  return NextResponse.json(snapshot);
}
