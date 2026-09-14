import { prisma } from "@/lib/db/prisma";

/**
 * Records a server-side failure so /admin/logs can show it.
 *
 * Before this existed the errors tab told the admin that error logging "hasn't
 * been implemented yet", so the only way to see what was failing in production
 * was to SSH in and read pm2 logs (QA 2026-09-15, A02).
 *
 * Still calls console.error: the pm2 log stays the live view, this is the
 * durable, queryable one.
 */

/** Long stacks are noise past the first few frames and this is SQLite. */
const MAX_STACK = 4000;
const MAX_MESSAGE = 1000;

export interface LogErrorInput {
  /** Where it happened: a route path, or "cron:<job>" / "worker:<name>". */
  source: string;
  error: unknown;
  level?: "error" | "warn";
  userId?: string | null;
  requestId?: string | null;
}

export async function logError({ source, error, level = "error", userId, requestId }: LogErrorInput): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;

  console.error(`[${source}]`, error);

  try {
    await prisma.errorLog.create({
      data: {
        level,
        source: source.slice(0, 200),
        message: message.slice(0, MAX_MESSAGE),
        stack: stack ? stack.slice(0, MAX_STACK) : null,
        userId: userId ?? null,
        requestId: requestId ?? null,
      },
    });
  } catch (writeErr) {
    // Never let the act of reporting a failure become one. A route that called
    // this is already on its error path; throwing here would replace a handled
    // error with an unhandled one.
    console.error("[errorLog] failed to persist an error report:", writeErr);
  }
}
