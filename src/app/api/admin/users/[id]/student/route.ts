export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { activateStudentAsAdmin } from "@/lib/student/adminActivation";
import { z } from "zod";

/** Admin grant of the student package without payment: activates, or extends an active plan by the given days. Audited. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  if (req.headers.get("origin") !== (process.env.NODE_ENV === "production" ? "https://aifekr.com" : req.nextUrl.origin)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  let body: { days: number; reason?: string };
  try {
    body = z.object({ days: z.number().int().min(1).max(366), reason: z.string().max(500).optional() }).strict().parse(await req.json());
  } catch {
    return NextResponse.json({ error: "مدت باید عدد صحیح بین ۱ تا ۳۶۶ روز باشد" }, { status: 400 });
  }
  try {
    const user = await activateStudentAsAdmin(id, admin.id, body.days, body.reason?.trim() || "");
    return NextResponse.json({ user });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known: Record<string, string> = { STUDENT_PACKAGE_INACTIVE: "پکیج دانشجویی غیرفعال است", INVALID_STUDENT_DAYS: "مدت نامعتبر است" };
    if (known[code]) return NextResponse.json({ error: known[code] }, { status: 400 });
    if ((error as { code?: string })?.code === "P2025") return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    throw error;
  }
}
