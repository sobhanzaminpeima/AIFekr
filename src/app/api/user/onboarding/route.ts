import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse(req);

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { businessType, goal, selectedPlan, period } = body;

  await prisma.user.update({
    where: { id: auth.id },
    data: {
      onboardingDone: true,
      // Pre-fill Company if not set
    },
  });

  // Return recommended tool based on answers
  let redirect = "/chat";
  if (businessType === "student" || goal === "study") redirect = "/student";
  else if (goal === "content") redirect = "/seo/agent-pipeline";
  else if (goal === "analysis") redirect = "/business-doctor";
  else if (goal === "social") redirect = "/social";
  else if (goal === "startup") redirect = "/startup/builder";
  else if (goal === "image") redirect = "/image/generate";

  const requestedPlan = typeof selectedPlan === "string" ? selectedPlan : auth.accountType === "STUDENT" && !await isStudentWorkspaceEnabled(auth) ? STUDENT_PLAN_CODE : null;
  if (requestedPlan) {
    const pack = await prisma.package.findUnique({ where: { planCode: requestedPlan }, select: { isActive: true } });
    if (pack?.isActive) {
      const billingPeriod = ["monthly", "quarterly", "semiannual"].includes(period) ? period : "monthly";
      redirect = `/plans?plan=${encodeURIComponent(requestedPlan)}&period=${requestedPlan.startsWith("STUDENT_") ? "monthly" : billingPeriod}`;
    }
  }
  return NextResponse.json({ redirect });
}
