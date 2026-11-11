/**
 * Scheduler that actually publishes (roadmap E8): a post whose publish call
 * failed at Instagram is tried once more after a pause, then marked failed
 * with the reason. A missing connection or media is not retried: waiting
 * cannot fix it.
 */
export const MAX_PUBLISH_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 10 * 60 * 1000;

export function afterPublishFailure(attemptsSoFar: number, retryable: boolean, now = new Date()) {
  const attempts = attemptsSoFar + 1;
  if (retryable && attempts < MAX_PUBLISH_ATTEMPTS) {
    return { status: "PENDING" as const, attempts, scheduledFor: new Date(now.getTime() + RETRY_DELAY_MS), notify: false };
  }
  return { status: "FAILED" as const, attempts, scheduledFor: null, notify: true };
}
