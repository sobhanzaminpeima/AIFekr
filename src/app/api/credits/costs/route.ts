export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getCreditCosts } from "@/lib/utils/creditCosts";

/**
 * Read-only credit-cost table for the frontend -- lets paid buttons show
 * "35 credits" etc. without hardcoding the number in a dozen components.
 * Reads the same admin-editable SiteSetting as the charge routes
 * themselves, so a price change in the admin panel is reflected here
 * immediately.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  return NextResponse.json({ costs: await getCreditCosts() });
}
