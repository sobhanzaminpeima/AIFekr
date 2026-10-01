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
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ماژول دانشجویی برای حساب شما فعال نیست</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>برای فعال‌سازی با مدیر پلتفرم تماس بگیرید.</p>
      </div>
    );
  }
  return <StudentWorkspace />;
}
