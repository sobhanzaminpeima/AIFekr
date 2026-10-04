export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  if (!body || typeof body !== "object") return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  const { title, examAt } = body as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200 || typeof examAt !== "string" || !examAt || Number.isNaN(new Date(examAt).getTime())) return NextResponse.json({ error: "عنوان و تاریخ معتبر الزامی است" }, { status: 400 });
  const result = await prisma.studentExam.updateMany({ where: { id: params.id, userId: user.id }, data: { title: title.trim(), examAt: new Date(examAt) } });
  if (!result.count) return NextResponse.json({ error: "امتحان پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const result = await prisma.studentExam.deleteMany({ where: { id: params.id, userId: user.id } });
  if (!result.count) return NextResponse.json({ error: "امتحان پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
