export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getHomeSummary } from "@/lib/home/summary";
import { getServerLang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";

/**
 * Deliberately not gated behind hasCrmAccess(): the home page has to render
 * for every signed-in user, including one who has not bought the CRM add-on.
 * Such a workspace simply has nothing to report, and getHomeSummary returns
 * empty counts — which the page shows as its getting-started state.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  const summary = await getHomeSummary(ws.workspaceUserId, lang, ws.businessId);

  // Which industry pack (if any) this account has -- the home page uses this
  // for a one-line "your X modules are active" banner. A user only ever
  // wonders this once, right after buying a pack, but nothing on the page
  // told them their purchase actually took effect.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { industryPackId: true, crmPlan: true, crmPlanExpiry: true } });
  const pack = dbUser?.industryPackId
    ? await prisma.industryPack.findUnique({ where: { id: dbUser.industryPackId }, select: { name: true, nameEn: true, emoji: true, slug: true } })
    : null;

  const studentEnabled = await isStudentWorkspaceEnabled(user);
  const student = studentEnabled
    ? await Promise.all([
        prisma.studentCourse.count({ where: { userId: user.id } }),
        prisma.studentExam.count({ where: { userId: user.id, examAt: { gte: new Date() } } }),
        prisma.studentTask.count({ where: { userId: user.id, completedAt: null } }),
      ])
    : [0, 0, 0];
  const crmActive = !!dbUser?.crmPlan && dbUser.crmPlan !== "NONE" && (!dbUser.crmPlanExpiry || dbUser.crmPlanExpiry > new Date());

  return NextResponse.json({
    ...summary,
    industryPack: pack,
    studentWorkspace: { enabled: studentEnabled, courseCount: student[0], upcomingExamCount: student[1], pendingTaskCount: student[2] },
    businessAccess: crmActive || !!pack,
  });
}
