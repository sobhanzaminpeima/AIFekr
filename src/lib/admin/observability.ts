/**
 * Owner observability (roadmap E12), first slice: the few signals that answer
 * "is something broken right now?" from stored data, with no provider call.
 * Each signal carries its own verdict so the page can lead with what needs
 * attention.
 */
export type Verdict = "ok" | "attention" | "broken";

export function fallbackVerdict(failures: number, chatRequests: number): Verdict {
  if (!failures) return "ok";
  const rate = chatRequests ? failures / chatRequests : 1;
  return rate > 0.5 ? "broken" : rate > 0.1 ? "attention" : "ok";
}

export function eventVerdict(lastAcceptedAt: Date | null, failedLastDay: number, now = Date.now()): Verdict {
  if (!lastAcceptedAt) return "attention";
  if (now - lastAcceptedAt.getTime() > 7 * 864e5) return "broken";
  return failedLastDay > 0 ? "attention" : "ok";
}

/** Approved exchange rates the purchase path needs: missing or expired blocks buying in that currency. */
export function rateVerdicts(latest: { target: string; validUntil: Date }[], targets: string[], now = Date.now()) {
  return targets.map((target) => {
    const row = latest.filter((r) => r.target === target).sort((a, b) => b.validUntil.getTime() - a.validUntil.getTime())[0];
    const verdict: Verdict = !row || row.validUntil.getTime() <= now ? "broken" : row.validUntil.getTime() - now < 864e5 ? "attention" : "ok";
    return { target, validUntil: row?.validUntil.toISOString() ?? null, verdict };
  });
}
