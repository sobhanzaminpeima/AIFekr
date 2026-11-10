export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { releaseInstagramConnection } from "@/lib/instagram/ownership";

/** Which platform account holds each Instagram account. Tokens never leave the server. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.instagramConnection.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, igUserId: true, igUsername: true, businessId: true, tokenExpiry: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  const now = Date.now();
  return NextResponse.json({ connections: rows.map((r) => ({ ...r, expired: !!r.tokenExpiry && r.tokenExpiry.getTime() <= now })) });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (req.headers.get("origin") !== (process.env.NODE_ENV === "production" ? "https://aifekr.com" : req.nextUrl.origin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await releaseInstagramConnection(id, admin.id, "admin_release"))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
