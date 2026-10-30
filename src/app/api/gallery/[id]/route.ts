import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Deletes one of the caller's own generated images, videos or music tracks.
 * The gallery page called this route for a long time without it existing, so
 * "Deleted" was shown while nothing was removed. ?type= narrows the lookup;
 * without it the id is looked up in all three. Voice audio is deleted from
 * Voice Studio, which also handles its stored file.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type");
  const where = { id, userId: user.id };
  if (!type || type === "image") {
    const { count } = await prisma.generatedImage.deleteMany({ where });
    if (count) return NextResponse.json({ ok: true });
  }
  if (!type || type === "video") {
    const { count } = await prisma.generatedVideo.deleteMany({ where });
    if (count) return NextResponse.json({ ok: true });
  }
  if (!type || type === "music") {
    const { count } = await prisma.generatedMusic.deleteMany({ where });
    if (count) return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
