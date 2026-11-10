export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const LIST_LIMIT = 50;
const summary = { id: true, tool: true, keyword: true, url: true, credits: true, status: true, createdAt: true } as const;

/** The signed-in user's saved SEO results: the list without bodies, or one full result with ?id=. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const generation = await prisma.seoGeneration.findFirst({ where: { id, userId: user.id } });
    if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ generation });
  }

  const generations = await prisma.seoGeneration.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: summary,
  });
  return NextResponse.json({ generations });
}

/** Removes one of the user's own saved results. */
export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { count } = await prisma.seoGeneration.deleteMany({ where: { id, userId: user.id } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
