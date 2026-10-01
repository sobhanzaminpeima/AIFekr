export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";

export async function GET(_req: Request, context: { params: { slug: string } }) {
  const user = await prisma.user.findFirst({ where: { studentPublicSlug: context.params.slug.toLowerCase(), studentProfilePublic: true }, select: { id: true, name: true, email: true, avatar: true, studentPublicSlug: true } });
  if (!user) return NextResponse.json({ error: "پروفایل دانشجویی پیدا نشد" }, { status: 404 });
  if (!await isStudentWorkspaceEnabled({ id: user.id })) return NextResponse.json({ error: "فضای دانشجویی موقتاً غیرفعال است" }, { status: 503 });
  return NextResponse.json({ profile: { name: user.name, email: user.email, avatar: user.avatar, studentPublicSlug: user.studentPublicSlug } });
}
