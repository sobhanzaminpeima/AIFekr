export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminNavShell from "@/components/admin/AdminNavShell";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, role: true, isBlocked: true },
  });

  if (!user || user.isBlocked) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") redirect("/chat");

  return (
    <div className="platform-shell admin-shell flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      <AdminNavShell sidebar={<AdminSidebar adminName={user?.name || "ادمین"} role={user?.role || "ADMIN"} />}>{children}</AdminNavShell>
    </div>
  );
}
export const metadata = { robots: { index: false, follow: false } };
