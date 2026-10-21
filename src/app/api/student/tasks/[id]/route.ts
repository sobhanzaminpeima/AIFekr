export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { title?: string; description?: string; dueAt?: string | null; priority?: number; completed?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  if (["title","content","question","answer","name","inviteCode","message","email","description"].some((key) => (body as Record<string, unknown>)[key] !== undefined && typeof (body as Record<string, unknown>)[key] !== "string")) return NextResponse.json({ error: "فیلدهای متنی معتبر نیستند" }, { status: 400 });
  const data: { title?: string; description?: string; dueAt?: Date | null; priority?: number; completedAt?: Date | null } = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title || title.length > 200) return NextResponse.json({ error: "عنوان باید بین ۱ تا ۲۰۰ نویسه باشد" }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) {
    if (body.description.length > 4000) return NextResponse.json({ error: "توضیحات بیش از حد طولانی است" }, { status: 400 });
    data.description = body.description.trim();
  }
  if (body.dueAt !== undefined) {
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.dueAt && (!dueAt || Number.isNaN(dueAt.getTime()))) return NextResponse.json({ error: "تاریخ معتبر نیست" }, { status: 400 });
    data.dueAt = dueAt;
  }
  if (body.priority !== undefined) {
    if (!Number.isInteger(body.priority) || body.priority < 1 || body.priority > 3) return NextResponse.json({ error: "اولویت معتبر نیست" }, { status: 400 });
    data.priority = body.priority;
  }
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") return NextResponse.json({ error: "وضعیت تکمیل معتبر نیست" }, { status: 400 });
    data.completedAt = body.completed ? new Date() : null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "تغییری برای ذخیره ارسال نشده است" }, { status: 400 });
  const result = await prisma.studentTask.updateMany({ where: { id: context.params.id, userId: user.id }, data });
  if (result.count === 0) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });
  const task = await prisma.studentTask.findFirst({ where: { id: context.params.id, userId: user.id }, include: { course: { select: { id: true, name: true, color: true } } } });
  return NextResponse.json({ task });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const deleted = await prisma.studentTask.deleteMany({ where: { id: context.params.id, userId: user.id } });
  if (!deleted.count) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
