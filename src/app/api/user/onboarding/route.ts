import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const { businessType, goal, experience } = await req.json();

  await prisma.user.update({
    where: { id: auth.id },
    data: {
      onboardingDone: true,
      // Pre-fill Company if not set
    },
  });

  // Return recommended tool based on answers
  let redirect = "/chat";
  if (goal === "content") redirect = "/seo/agent-pipeline";
  else if (goal === "analysis") redirect = "/business-doctor";
  else if (goal === "social") redirect = "/social";
  else if (goal === "startup") redirect = "/startup/builder";
  else if (goal === "image") redirect = "/image/generate";

  return NextResponse.json({ redirect });
}
