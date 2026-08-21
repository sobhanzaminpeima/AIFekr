export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/utils/currency";

/** Public (unauthenticated) — client components need this for landing-page pricing display, same cached rates the server components use internally via formatPackPrice(). */
export async function GET() {
  const rates = await getFxRates();
  return NextResponse.json(rates);
}
