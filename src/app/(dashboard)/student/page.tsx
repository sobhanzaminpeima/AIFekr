import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StudentWorkspace from "@/components/student/StudentWorkspace";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, isBlocked: true } });
  if (!user || user.isBlocked) redirect("/login");
  if (!await isStudentWorkspaceEnabled(user)) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ایجنت دانشجویی برای حساب شما فعال نیست</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>این ایجنت فقط برای حساب دانشجویی با پکیج دانشجویی فعال قابل استفاده است.</p>
        <Link href="/pricing" className="inline-block mt-4 rounded-xl px-4 py-2 text-white" style={{background:"var(--primary)"}}>مشاهده و تمدید پکیج دانشجویی</Link>
      </div>
    );
  }
  return <StudentWorkspace />;
}
