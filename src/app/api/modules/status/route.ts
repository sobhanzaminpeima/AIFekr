export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { blockedModules } from "@/lib/modules/moduleStatus";

/** Public: which modules an admin has switched off, so navigation can hide them. Module keys and statuses only. */
export async function GET() {
  return NextResponse.json({ blocked: await blockedModules() }, { headers: { "Cache-Control": "public, max-age=30" } });
}
