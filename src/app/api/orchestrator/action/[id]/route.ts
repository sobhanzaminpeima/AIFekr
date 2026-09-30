export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/utils/rateLimit";
import { buildWorkspaceContext } from "@/lib/orchestrator/isolation";
import { gateToolCall } from "@/lib/orchestrator/modes";
import { getTool } from "@/lib/orchestrator/tools";

/**
 * Confirms (POST) or rejects (DELETE) one staged COMMIT action.
 *
 * This is the second half of the two-turn confirmation the Phase 1
 * architecture requires: the chat turn that proposed the action only stored
 * it, and nothing ran. Execution happens here, and only here.
 *
 * Everything is re-checked at execution time rather than trusted from when
 * the action was staged, because minutes may have passed:
 *
 *   - the session is re-authenticated;
 *   - the workspace context is rebuilt from scratch, so a user who has since
 *     been removed from a team, or whose CRM add-on lapsed, no longer passes;
 *   - the action must belong to this workspace AND have been staged by this
 *     same acting user, so one team member cannot fire another's staged write;
 *   - the status must still be PENDING, which makes it single-use;
 *   - the TTL must not have passed, so a stale button in an old tab is inert;
 *   - the tool passes the deny/tier/plan gate again;
 *   - the stored arguments are re-validated by the tool's own validator.
 *
 * The arguments executed are the ones stored at propose time — never anything
 * resent by the client — so the confirmation card the user read and the write
 * that happens are the same thing by construction.
 */

async function loadAction(id: string) {
  return prisma.orchestratorAction.findUnique({ where: { id } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const limit = rateLimit(`orchestrator-action:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  const { id } = await params;
  const action = await loadAction(id);
  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lang = await getServerLang();
  const ctx = await buildWorkspaceContext({ id: user.id, plan: user.plan, voicePlan: user.voicePlan }, lang);

  // Ownership: same workspace and the same person who staged it. Checked
  // before status/expiry so a foreign id is indistinguishable from a missing
  // one to the caller.
  if (action.workspaceUserId !== ctx.workspaceUserId || action.actingUserId !== ctx.actingUserId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (action.status !== "PENDING") {
    return NextResponse.json({ error: "already_resolved", status: action.status }, { status: 409 });
  }

  if (action.expiresAt.getTime() < Date.now()) {
    await prisma.orchestratorAction.update({ where: { id: action.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const tool = getTool(action.toolKey);
  const decision = gateToolCall({
    mode: "full_mode",
    toolKey: action.toolKey,
    tier: tool?.tier,
    planSatisfied: tool?.planSatisfied ? tool.planSatisfied(ctx) : true,
  });
  if (!decision.allowed || !tool) {
    await prisma.orchestratorAction.update({
      where: { id: action.id },
      data: { status: "FAILED", resultJson: JSON.stringify({ gate: decision }) },
    });
    return NextResponse.json({ error: "not_allowed", reason: decision.allowed ? "unknown_tool" : decision.reason }, { status: 403 });
  }

  // Re-validate the stored arguments. They were validated once at propose
  // time; re-running the validator means a tool whose rules have since
  // tightened cannot be executed with arguments that are no longer legal.
  let args: unknown;
  try {
    args = tool.validate ? tool.validate(JSON.parse(action.argsJson), ctx) : {};
  } catch {
    args = null;
  }
  if (args === null) {
    await prisma.orchestratorAction.update({
      where: { id: action.id },
      data: { status: "FAILED", resultJson: JSON.stringify({ error: "stored_args_no_longer_valid" }) },
    });
    return NextResponse.json({ error: "invalid_args" }, { status: 422 });
  }

  // Claim the action before doing the work. Two rapid clicks on the same card
  // would otherwise both pass the PENDING check above and execute the write
  // twice; the conditional update means only the first claim wins.
  const claim = await prisma.orchestratorAction.updateMany({
    where: { id: action.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  try {
    const result = await tool.run(args as never, ctx);
    await prisma.orchestratorAction.update({
      where: { id: action.id },
      data: { status: "EXECUTED", resultJson: JSON.stringify(result.data) },
    });
    return NextResponse.json({ status: "EXECUTED", toolKey: action.toolKey, summary: action.summary, result: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] executing ${action.toolKey} failed:`, err);
    await prisma.orchestratorAction.update({
      where: { id: action.id },
      data: { status: "FAILED", resultJson: JSON.stringify({ error: message.slice(0, 500) }) },
    });
    return NextResponse.json({ error: "execution_failed" }, { status: 502 });
  }
}

/** Rejects a staged action. Nothing runs; the row is kept as a record that it was offered and declined. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const action = await loadAction(id);
  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lang = await getServerLang();
  const ctx = await buildWorkspaceContext({ id: user.id, plan: user.plan, voicePlan: user.voicePlan }, lang);
  if (action.workspaceUserId !== ctx.workspaceUserId || action.actingUserId !== ctx.actingUserId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (action.status !== "PENDING") {
    return NextResponse.json({ error: "already_resolved", status: action.status }, { status: 409 });
  }

  await prisma.orchestratorAction.updateMany({
    where: { id: action.id, status: "PENDING" },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ status: "REJECTED" });
}

/** Lets the client re-read one card's current state — e.g. after a reload, so a resolved action doesn't render a live button. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const action = await loadAction(id);
  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lang = await getServerLang();
  const ctx = await buildWorkspaceContext({ id: user.id, plan: user.plan, voicePlan: user.voicePlan }, lang);
  if (action.workspaceUserId !== ctx.workspaceUserId || action.actingUserId !== ctx.actingUserId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: action.id,
    toolKey: action.toolKey,
    summary: action.summary,
    status: action.status,
    expiresAt: action.expiresAt,
    expired: action.status === "PENDING" && action.expiresAt.getTime() < Date.now(),
  });
}
