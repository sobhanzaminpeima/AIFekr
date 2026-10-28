import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { growthFlag } from "@/lib/growth/config";
import { trackEvent } from "@/lib/growth/events";
import { OBJECTIVE_WORKSPACE, WORKSPACE_IDS, type WorkspaceId } from "@/lib/navigation/workspaces";

/**
 * The user's workspace preference. Presentation only: it changes what the
 * sidebar and home show first, never entitlements, billing or route access.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!(await growthFlag("adaptive_workspaces_enabled"))) return NextResponse.json({ enabled: false, workspaces: [], active: null });
  const p = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { workspaces: true, activeWorkspace: true, objective: true } });
  let workspaces = (p?.workspaces || "").split(",").filter((w): w is WorkspaceId => (WORKSPACE_IDS as string[]).includes(w));
  // Suggest (not save) a workspace from onboarding answers or account type until the user picks one.
  const suggested: WorkspaceId | null = OBJECTIVE_WORKSPACE[p?.objective ?? ""] ?? (user.accountType === "STUDENT" ? "student" : user.accountType === "FITNESS" ? "fitness" : null);
  if (!workspaces.length && suggested) workspaces = [suggested];
  const active = p?.activeWorkspace && (WORKSPACE_IDS as string[]).includes(p.activeWorkspace) ? p.activeWorkspace as WorkspaceId : null;
  return NextResponse.json({ enabled: true, workspaces, active, suggested });
}

const body = z.object({
  workspaces: z.array(z.enum(WORKSPACE_IDS as [WorkspaceId, ...WorkspaceId[]])).max(6).optional(),
  /** null = classic full navigation ("All tools"). */
  active: z.enum(WORKSPACE_IDS as [WorkspaceId, ...WorkspaceId[]]).nullable(),
});

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const { active } = parsed.data;
  const list = [...new Set([...(parsed.data.workspaces ?? []), ...(active ? [active] : [])])];
  await prisma.growthProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, workspaces: list.join(","), activeWorkspace: active },
    update: { ...(parsed.data.workspaces ? { workspaces: list.join(",") } : {}), activeWorkspace: active },
  });
  await trackEvent({ name: "workspace_selected", userId: user.id, metadata: { active: active ?? "all", count: list.length } });
  return NextResponse.json({ ok: true, workspaces: list, active });
}
