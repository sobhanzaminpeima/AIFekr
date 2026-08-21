import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";
import { prisma } from "@/lib/db/prisma";

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      plan: true,
      credits: true,
      planExpiry: true,
      isBlocked: true,
      crmPlan: true,
      crmPlanExpiry: true,
      voicePlan: true,
      voicePlanExpiry: true,
    },
  });

  if (!user || user.isBlocked) return null;

  // A lapsed paid plan must fall back to FREE-tier limits everywhere plan
  // gates read user.plan (image/video/music generation, CRM contact caps,
  // social auto-publish, etc.) — planExpiry was being stored but never
  // enforced, so every non-team paid plan kept full access forever after
  // the subscription lapsed. Downgrading here (the single shared auth
  // entry point) closes that gap for every caller at once, mirroring the
  // expiry check hasVoiceAccess already does for the Voice add-on.
  if (user.plan !== "FREE" && user.planExpiry && user.planExpiry.getTime() < Date.now()) {
    user.plan = "FREE";
  }

  return user;
}

export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return null;
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "احراز هویت الزامی است" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
}
