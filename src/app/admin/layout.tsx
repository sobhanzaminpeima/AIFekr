export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") redirect("/chat");

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, role: true },
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      <AdminSidebar adminName={user?.name || "ادمین"} role={user?.role || "ADMIN"} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
