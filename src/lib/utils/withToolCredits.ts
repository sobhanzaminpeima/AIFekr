import type { NextRequest } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { reserveToolCredits } from "@/lib/utils/toolCredits";
import { claimIdempotencyKey, idempotencyKeyOf, idempotencyRequestId, releaseIdempotencyKey } from "@/lib/utils/idempotency";
import { NextResponse } from "next/server";

/**
 * Wraps a route handler so it is charged before it runs and refunded if it
 * throws or answers with an error status. Streaming routes answer 200 and
 * report failures inside the stream, so for those the refund covers a crash
 * before the stream opens; a failure mid-stream keeps the charge, the same
 * as chat does once it has started answering.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withToolCredits<A extends any[]>(
  feature: string,
  handler: (req: NextRequest, ...rest: A) => Promise<Response>,
) {
  return async (req: NextRequest, ...rest: A): Promise<Response> => {
    const user = await requireAuth(req);
    if (!user) return unauthorizedResponse(req);
    // A repeated submission (double click, network retry) with the same key is refused before any charge.
    const key = idempotencyKeyOf(req.headers);
    if (key && !claimIdempotencyKey(user.id, feature, key)) {
      return NextResponse.json({ error: "This request is already being processed.", code: "DUPLICATE_REQUEST" }, { status: 409 });
    }
    const forget = () => { if (key) releaseIdempotencyKey(user.id, feature, key); };
    const gate = await reserveToolCredits(user.id, feature, key ? { requestId: idempotencyRequestId(feature, key) } : {});
    if (!gate.ok) { forget(); return gate.response; }
    try {
      const res = await handler(req, ...rest);
      if (res.status >= 400) { await gate.release(); forget(); }
      return res;
    } catch (e) {
      await gate.release();
      forget();
      throw e;
    }
  };
}
