export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAllFeatureToggles } from "@/lib/utils/featureToggles";

/**
 * Public, unauthenticated — the generate pages (image/video/music) call this
 * to know whether to show their normal form or a "disabled by admin" banner.
 * No sensitive data here, just three booleans.
 */
export async function GET() {
  const toggles = await getAllFeatureToggles();
  return NextResponse.json(toggles);
}
