export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken, getBiExport } from "@/lib/accounting/biApi";

/**
 * The external-BI export endpoint (spec ۴). Deliberately outside
 * /api/accounting — this is not a session-authenticated route at all, it's a
 * long-lived bearer token minted via /api/accounting/bi-tokens. Read-only:
 * there is no POST/PUT here and getBiExport() never touches the ledger.
 *
 * Usage: GET /api/bi/accounting?from=2026-01-01&to=2026-01-31
 * Header: Authorization: Bearer <token>
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  const workspaceUserId = await verifyApiToken(match[1]);
  if (!workspaceUserId) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getFullYear(), to.getMonth(), 1);

  const data = await getBiExport(workspaceUserId, from, to);
  return NextResponse.json(data);
}
