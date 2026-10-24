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

  if(auth.accountType==="FITNESS")return NextResponse.json({redirect:"/fitness"});
  // Return recommended tool based on answers
  let redirect = "/chat";
  if (businessType === "real_estate" && !selectedPlan) {
    // Real estate is the industry pack behind the CRM's property, owner and
    // viewing modules. A pack can only be switched on with an active CRM plan
    // (same rule as POST /api/packs/[slug]); without one the user lands on the
    // pack page that explains it and leads to purchase.
    const crmActive = !!auth.crmPlan && auth.crmPlan !== "NONE" && (!auth.crmPlanExpiry || auth.crmPlanExpiry.getTime() > Date.now());
    const pack = crmActive ? await prisma.industryPack.findFirst({ where: { slug: "real-estate", isActive: true }, select: { id: true } }) : null;
    if (pack) {
      await prisma.user.update({ where: { id: auth.id }, data: { industryPackId: pack.id } });
      return NextResponse.json({ redirect: "/crm" });
    }
    return NextResponse.json({ redirect: "/industry/real-estate" });
  }
  if (businessType === "fitness" && !selectedPlan) return NextResponse.json({ redirect: "/fit" });
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
