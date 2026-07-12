export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavShell from "@/components/layout/MobileNavShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) redirect("/login");
  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  const lang = (cookieStore.get("lang")?.value === "en") ? "en" : "fa";

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, credits: true, plan: true, isBlocked: true, industryPackId: true },
  });

  if (!user || user.isBlocked) redirect("/login");

  // If this user has joined a team (as owner or member), the sidebar should
  // show the shared team credit pool instead of user.credits — actual
  // deduction already goes through the pool, see src/lib/utils/teamCredits.ts.
  const teamMembership = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    include: { team: { select: { credits: true } } },
  });
  const displayCredits = teamMembership?.team.credits ?? user.credits;

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, updatedAt: true, projectId: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      <MobileNavShell
        lang={lang}
        sidebar={
          <Sidebar
            user={{ ...user, credits: displayCredits }}
            conversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))}
          />
        }
      >
        {children}
      </MobileNavShell>
    </div>
  );
}