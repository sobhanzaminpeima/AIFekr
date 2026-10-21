export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/requireOwner";

export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (!owner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ owner: { name: owner.name, email: owner.email } });
}
