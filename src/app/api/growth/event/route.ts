import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLIENT_EVENTS, trackEvent } from "@/lib/growth/events";
import { anonIdFor, sessionUserId, setAnonCookie } from "@/lib/growth/request";
import { growthModule } from "@/lib/growth/modules";

const body = z.object({
  name: z.string().max(60),
  moduleId: z.string().max(40).optional().nullable(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  /** Client-generated key so a retried beacon is stored once. */
  key: z.string().regex(/^[a-zA-Z0-9:_-]{8,100}$/).optional(),
});

/** Browser events; only the non-financial allowlist in CLIENT_EVENTS is accepted. */
export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !CLIENT_EVENTS.has(parsed.data.name)) return NextResponse.json({ ok: false }, { status: 400 });
  const userId = sessionUserId(req);
  const { anonId, fresh } = anonIdFor(req);
  const moduleId = growthModule(parsed.data.moduleId)?.id ?? null;
  const owner = userId ?? anonId;
  await trackEvent({ name: parsed.data.name, userId, anonId: userId ? null : anonId, moduleId, metadata: parsed.data.metadata, source: "client", idempotencyKey: parsed.data.key ? `c:${owner}:${parsed.data.key}` : undefined });
  const res = NextResponse.json({ ok: true });
  if (!userId && fresh) setAnonCookie(res, anonId);
  return res;
}
