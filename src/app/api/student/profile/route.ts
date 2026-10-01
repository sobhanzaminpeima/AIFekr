export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const user = await prisma.user.findUnique({ where: { id: auth.id }, select: { name: true, email: true, avatar: true, studentPublicSlug: true, studentProfilePublic: true } });
  return NextResponse.json({ profile: user });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  let body: { slug?: unknown; isPublic?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (typeof body.slug !== "string" || typeof body.isPublic !== "boolean") return NextResponse.json({ error: "شناسهٔ عمومی و وضعیت انتشار معتبر نیست" }, { status: 400 });
  const slug = body.slug.trim().toLowerCase();
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(slug)) return NextResponse.json({ error: "شناسه باید ۳ تا ۳۰ حرف کوچک انگلیسی، عدد یا خط تیره باشد" }, { status: 400 });
  if (body.isPublic && !slug) return NextResponse.json({ error: "برای فعال‌کردن پروفایل عمومی، ابتدا یک شناسه انتخاب کنید" }, { status: 400 });
  try {
    const user = await prisma.user.update({ where: { id: auth.id }, data: { studentPublicSlug: slug || null, studentProfilePublic: body.isPublic }, select: { name: true, email: true, avatar: true, studentPublicSlug: true, studentProfilePublic: true } });
    return NextResponse.json({ profile: user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "این شناسه قبلاً گرفته شده است" }, { status: 409 });
    throw error;
  }
}
