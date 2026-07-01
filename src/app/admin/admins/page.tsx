export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/prisma";
import AdminManageClient from "./AdminManageClient";

export default async function AdminsPage() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MODERATOR"] } },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true, isBlocked: true },
    orderBy: { createdAt: "desc" },
  });

  const allUsers = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <AdminManageClient admins={admins} allUsers={allUsers} />;
}
