export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPost, loadWpConn } from "@/lib/wordpress/client";
import { markdownToHtml } from "@/lib/utils/markdownToHtml";
import { draftFromGeneration } from "@/lib/seo/toWordpress";

/** E14: send one of the user's saved SEO results to their WordPress as a draft. Nothing is published. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;
  const generation = await prisma.seoGeneration.findFirst({ where: { id, userId: user.id }, select: { tool: true, keyword: true, output: true } });
  if (!generation) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const draft = draftFromGeneration(generation);
  if (!draft) return NextResponse.json({ code: "NOT_A_POST" }, { status: 400 });
  const conn = await loadWpConn(user.id);
  if (!conn) return NextResponse.json({ code: "WORDPRESS_NOT_CONNECTED" }, { status: 409 });
  const result = await createPost(conn, { ...draft, contentHtml: markdownToHtml(generation.output), status: "draft" });
  if (!result.ok) return NextResponse.json({ code: "WORDPRESS_FAILED", error: result.error }, { status: 502 });
  return NextResponse.json({ post: { id: result.id, editUrl: result.editUrl, status: result.status, seo: result.seo } });
}
