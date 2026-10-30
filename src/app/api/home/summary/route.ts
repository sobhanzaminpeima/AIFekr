export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { homePayload } from "@/lib/home/homePayload";

/** The home page's data; see lib/home/homePayload. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json(await homePayload(user));
}
