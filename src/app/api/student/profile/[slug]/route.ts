export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(_req: Request, context: { params: { slug: string } }) {
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const user = await prisma.user.findFirst({ where: { studentPublicSlug: context.params.slug.toLowerCase(), studentProfilePublic: true }, select: { name: true, email: true, avatar: true, studentPublicSlug: true } });
  if (!user) return NextResponse.json({ error: "پروفایل دانشجویی پیدا نشد" }, { status: 404 });
  return NextResponse.json({ profile: user });
}
